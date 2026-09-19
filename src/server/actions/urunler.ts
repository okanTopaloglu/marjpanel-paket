"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { adminKapsami } from "@/lib/auth/yetki";
import { alanHatalari } from "@/lib/form/alan-hatalari";
import { kaydet, sil, topluKaydet } from "@/lib/db/repos/urunler";
import { listele as entegrasyonlariListele } from "@/lib/db/repos/entegrasyonlar";
import { manuelIsEkle } from "@/lib/db/repos/senkron-isleri";
import {
  ALAN_ANAHTARLARI,
  AZAMI_DOSYA_BAYT,
  ONIZLEME_SATIRI,
  urunOku,
  type AlanAnahtari,
  type ExcelUrunSatiri,
} from "@/lib/excel/urun-oku";
import type { EylemDurumu } from "./auth";

/**
 * ÜRÜN EYLEMLERİ - katalog yönetimi.
 *
 * Kapı `adminKapsami()`: çalışan katalogu OKUR (okutma ekranı ürün adını
 * buradan alır) ama değiştiremez; yanlış bir toplu içe aktarım tüm depoyu
 * etkiler. Kiracı izolasyonu repo katmanında `Kapsam.sirketId` ile kurulur -
 * bu dosya hiçbir şirket kimliği taşımaz.
 */

const YETKISIZ_MESAJI = "Bu işlem için yetkiniz yok.";
const DUZELT_MESAJI = "Lütfen işaretli alanları düzeltin.";

/* ------------------------------------------------------------------ */
/* Tekil kayıt                                                          */
/* ------------------------------------------------------------------ */

/**
 * `gorselUrl` boş ya da http(s) bağlantısı olmalı: okutma ekranı bu değeri
 * doğrudan `<img src>` yapar, `javascript:` gibi bir şema oraya girmemeli.
 */
const gorselSemasi = z
  .string()
  .trim()
  .max(1000, "Görsel bağlantısı en fazla 1000 karakter olabilir.")
  .refine((v) => v === "" || /^https?:\/\//i.test(v), {
    message: "Görsel bağlantısı http:// ya da https:// ile başlamalı.",
  });

const urunSemasi = z.object({
  barkod: z
    .string()
    .trim()
    .min(1, "Barkod gerekli.")
    .max(64, "Barkod en fazla 64 karakter olabilir."),
  urunAdi: z.string().trim().max(300, "Ürün adı en fazla 300 karakter olabilir."),
  gorselUrl: gorselSemasi,
  marka: z.string().trim().max(120, "Marka en fazla 120 karakter olabilir."),
  kategori: z.string().trim().max(120, "Kategori en fazla 120 karakter olabilir."),
  stokKodu: z.string().trim().max(120, "Stok kodu en fazla 120 karakter olabilir."),
});

/**
 * Ürünü ekler ya da günceller (barkod anahtardır).
 *
 * BOŞ BIRAKILAN ALAN SİLMEZ, KORUR: repo `coalesce(nullif(...))` ile yazar.
 * Kullanıcı yalnız markayı düzeltmek için formu açtığında, senkronla gelen
 * görselin kaybolmaması gerekir.
 */
export async function urunKaydet(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = urunSemasi.safeParse({
    barkod: formData.get("barkod") ?? "",
    urunAdi: formData.get("urunAdi") ?? "",
    gorselUrl: formData.get("gorselUrl") ?? "",
    marka: formData.get("marka") ?? "",
    kategori: formData.get("kategori") ?? "",
    stokKodu: formData.get("stokKodu") ?? "",
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
  }

  await kaydet(kapsam, cozum.data);
  revalidatePath("/urunler");
  return { ok: true, mesaj: "Ürün kaydedildi." };
}

export async function urunSil(id: string): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const silinen = await sil(kapsam, id);
  if (silinen === 0) return { ok: false, mesaj: "Ürün bulunamadı." };

  revalidatePath("/urunler");
  return { ok: true, mesaj: "Ürün silindi." };
}

/* ------------------------------------------------------------------ */
/* Excel içe aktarma                                                    */
/* ------------------------------------------------------------------ */

/*
 * Sabitler `lib/excel/urun-oku` dosyasındadır: "use server" modülünden
 * YALNIZ async fonksiyon dışa aktarılabilir (Next derleyici kuralı), sabit
 * dışa aktarımı derlemeyi düşürür.
 */

export interface ExcelOnizlemesi {
  /** İlk 20 satır. */
  ornekler: ExcelUrunSatiri[];
  /** Dosyadaki geçerli (barkodu dolu) satır sayısı. */
  toplam: number;
  /** Barkodu boş olduğu için atlanan satır sayısı. */
  atlanan: number;
  /** Alan → dosyada eşleşen başlık (bulunamadıysa null). */
  sutunlar: Record<AlanAnahtari, string | null>;
  baslikSatiri: number | null;
}

export interface ExcelDurumu extends EylemDurumu {
  onizleme?: ExcelOnizlemesi;
  /** `mod: 'kaydet'` sonucunda yazılan satır sayısı. */
  kaydedilen?: number;
}

const BASLIK_YOK_MESAJI =
  "Barkod sütunu bulunamadı. Dosyanın ilk satırlarında “Barkod” (ya da “Barcode”) başlıklı bir sütun olmalı.";

function bosSutunlar(): Record<AlanAnahtari, string | null> {
  const cikti = {} as Record<AlanAnahtari, string | null>;
  for (const alan of ALAN_ANAHTARLARI) cikti[alan] = null;
  return cikti;
}

/**
 * Excel içe aktarma - İKİ AŞAMALI.
 *
 * `mod: 'onizle'` dosyayı okur ve ne yazılacağını gösterir; `mod: 'kaydet'`
 * AYNI dosyayı ikinci kez alıp yazar. Ayrıştırılmış satırları iki çağrı
 * arasında sunucuda tutmak (oturum/geçici tablo) 20.000 satırlık bir dosyayı
 * bellekte ya da diskte bekletmek demekti; dosya zaten istemcinin elinde,
 * tekrar göndermek en ucuz ve en az durumlu yol.
 *
 * Kullanıcı ÖNCE ne olacağını görür: hangi sütun neye bağlandı, kaç satır
 * gelecek, kaç satır atlandı. Sessizce yazan bir içe aktarım, yanlış
 * eşleşmeyi ancak katalog bozulduktan sonra fark ettirir.
 */
export async function excelAktar(
  _oncekiDurum: ExcelDurumu | undefined,
  formData: FormData,
): Promise<ExcelDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const mod = formData.get("mod") === "kaydet" ? "kaydet" : "onizle";
  const dosya = formData.get("dosya");

  if (!(dosya instanceof File) || dosya.size === 0) {
    return { ok: false, mesaj: "Önce bir .xlsx dosyası seçin." };
  }
  if (!dosya.name.toLowerCase().endsWith(".xlsx")) {
    return {
      ok: false,
      mesaj: "Yalnız .xlsx dosyası okunabilir. Eski .xls dosyasını Excel'de “xlsx” olarak kaydedin.",
    };
  }
  if (dosya.size > AZAMI_DOSYA_BAYT) {
    return {
      ok: false,
      mesaj: "Dosya 10 MB sınırını aşıyor. Listeyi bölüp iki dosya hâlinde aktarın.",
    };
  }

  let okunan;
  try {
    okunan = await urunOku(new Uint8Array(await dosya.arrayBuffer()));
  } catch {
    return {
      ok: false,
      mesaj: "Dosya okunamadı. Bozuk ya da parola korumalı olabilir; Excel'de açıp yeniden kaydedin.",
    };
  }

  if (okunan.baslikSatiri === null) {
    return { ok: false, mesaj: BASLIK_YOK_MESAJI, onizleme: {
      ornekler: [],
      toplam: 0,
      atlanan: okunan.atlanan,
      sutunlar: bosSutunlar(),
      baslikSatiri: null,
    } };
  }

  const onizleme: ExcelOnizlemesi = {
    ornekler: okunan.satirlar.slice(0, ONIZLEME_SATIRI),
    toplam: okunan.satirlar.length,
    atlanan: okunan.atlanan,
    sutunlar: okunan.sutunlar,
    baslikSatiri: okunan.baslikSatiri,
  };

  if (okunan.satirlar.length === 0) {
    return {
      ok: false,
      mesaj: "Dosyada barkodu dolu satır bulunamadı.",
      onizleme,
    };
  }

  if (mod === "onizle") {
    return {
      ok: true,
      mesaj: `${okunan.satirlar.length} satır okundu. Eşleşmeyi kontrol edip kaydedin.`,
      onizleme,
    };
  }

  const yazilan = await topluKaydet(kapsam, okunan.satirlar);
  revalidatePath("/urunler");
  return {
    ok: true,
    mesaj: `${yazilan} ürün kaydedildi.`,
    onizleme,
    kaydedilen: yazilan,
  };
}

/* ------------------------------------------------------------------ */
/* Trendyol ürün senkronu                                              */
/* ------------------------------------------------------------------ */

export interface SenkronBaslatmaDurumu extends EylemDurumu {
  /** Kuyruğa yeni iş eklendi mi (zaten bekleyen iş varsa false). */
  eklendi?: boolean;
}

/**
 * "Trendyol'dan ürünleri çek" - kuyruğa manuel ürün işi ekler.
 *
 * ENTEGRASYON SAHİPLİĞİ BURADA DOĞRULANIR: `manuelIsEkle` verilen kimliği
 * sorgulamaz, yalnız işi `Kapsam.sirketId` ile yazar. Doğrulamasız bırakılsa
 * bir yönetici başka şirketin entegrasyon kimliğini göndererek o mağazanın
 * senkronunu tetikleyebilirdi.
 *
 * Kuyruğa yazdıktan sonra zamanlayıcı `after()` içinde dürtülür: yanıt
 * kullanıcıya hemen döner, senkron arka planda başlar (cron ucundaki desenin
 * aynısı).
 */
export async function urunSenkronBaslat(
  entegrasyonId: string,
): Promise<SenkronBaslatmaDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const kimlik = (entegrasyonId ?? "").trim();
  if (!kimlik) return { ok: false, mesaj: "Önce bir mağaza seçin." };

  const kayitlar = await entegrasyonlariListele(kapsam.sirketId);
  const secilen = kayitlar.find((e) => e.id === kimlik);
  if (!secilen) return { ok: false, mesaj: "Entegrasyon bulunamadı." };
  if (!secilen.aktif) {
    return { ok: false, mesaj: "Bu mağaza pasif. Önce entegrasyonu aktifleştirin." };
  }

  const { eklendi } = await manuelIsEkle(kapsam, "urun", kimlik);
  if (!eklendi) {
    return {
      ok: true,
      eklendi: false,
      mesaj: "Bu mağaza için bir ürün senkronu zaten sırada.",
    };
  }

  after(async () => {
    try {
      const modul = await import("@/lib/senkron/zamanlayici");
      await modul.tik();
    } catch (hata) {
      console.error(
        `[urun] senkron tetiği düştü: ${hata instanceof Error ? hata.message : String(hata)}`,
      );
    }
  });

  revalidatePath("/urunler");
  return {
    ok: true,
    eklendi: true,
    mesaj: "Ürün senkronu sıraya alındı. Birkaç dakika sürebilir.",
  };
}
