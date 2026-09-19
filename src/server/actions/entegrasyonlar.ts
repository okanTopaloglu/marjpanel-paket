"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { adminKapsami } from "@/lib/auth/yetki";
import {
  EntegrasyonCakismasi,
  EntegrasyonLimiti,
  EntegrasyonYok,
  aralikKaydet as aralikKaydetRepo,
  kaydet,
  kimlikBilgileri,
  sil,
} from "@/lib/db/repos/entegrasyonlar";
import { manuelIsEkle } from "@/lib/db/repos/senkron-isleri";
import { trendyolIstemcisi } from "@/lib/trendyol/istemci";
import type { EylemDurumu } from "./auth";

/**
 * ENTEGRASYON EYLEMLERİ — yalnız yönetici.
 *
 * Her eylem kapıyı KENDİ açar (`adminKapsami`): sayfanın kapısı yeterli
 * değildir, eylem doğrudan çağrılabilir (eski sekme, devtools, betik).
 *
 * API ANAHTARI DÖNÜŞLERDE ASLA GEÇMEZ. Formdan yukarı çıkar, şifrelenip
 * veritabanına yazılır; aşağı yalnız maskeli hâli iner (repo maskeler).
 */

const YETKISIZ: EylemDurumu = {
  ok: false,
  mesaj: "Bu işlem için yönetici yetkisi gerekli.",
};

const YOL = "/entegrasyonlar";

const semasi = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  // Ad İSTEĞE BAĞLI: tek mağazası olan kullanıcı ad vermek zorunda değil,
  // boşsa liste platform adına düşer.
  ad: z.string().trim().max(60, "Mağaza adı en fazla 60 karakter olabilir.").optional(),
  saticiId: z
    .string()
    .trim()
    .min(1, "Satıcı ID gerekli.")
    .regex(/^\d+$/, "Satıcı ID yalnız rakamlardan oluşur."),
  apiKey: z.string().trim().max(200).optional(),
  apiSecret: z.string().trim().max(200).optional(),
});

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path[0];
    if (typeof alan === "string" && !cikti[alan]) cikti[alan] = sorun.message;
  }
  return cikti;
}

/**
 * Ekler ya da günceller.
 *
 * ANAHTARLAR YENİ KAYITTA ZORUNLU, DÜZENLEMEDE İSTEĞE BAĞLIDIR: form anahtarı
 * maskeli gösterir, kullanıcı yalnız adı değiştirmek için kaydettiğinde alan
 * boştur ve boş "değiştirme" demektir (repo eskisini korur).
 */
export async function entegrasyonKaydet(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  const ayristirma = semasi.safeParse({
    id: formData.get("id") ?? "",
    ad: formData.get("ad") ?? "",
    saticiId: formData.get("saticiId") ?? "",
    apiKey: formData.get("apiKey") ?? "",
    apiSecret: formData.get("apiSecret") ?? "",
  });
  if (!ayristirma.success) {
    return { ok: false, alanlar: alanHatalari(ayristirma.error) };
  }

  const veri = ayristirma.data;
  const id = veri.id || undefined;
  if (!id && (!veri.apiKey || !veri.apiSecret)) {
    return {
      ok: false,
      alanlar: {
        ...(veri.apiKey ? {} : { apiKey: "API anahtarı gerekli." }),
        ...(veri.apiSecret ? {} : { apiSecret: "Gizli anahtar gerekli." }),
      },
    };
  }

  try {
    await kaydet(kapsam, {
      id,
      ad: veri.ad ?? null,
      saticiId: veri.saticiId,
      apiKey: veri.apiKey,
      apiSecret: veri.apiSecret,
    });
  } catch (hata) {
    if (hata instanceof EntegrasyonCakismasi) {
      return { ok: false, alanlar: { saticiId: hata.message } };
    }
    if (hata instanceof EntegrasyonLimiti || hata instanceof EntegrasyonYok) {
      return { ok: false, mesaj: hata.message };
    }
    console.error("[entegrasyon] kaydetme hatası:", hata);
    return { ok: false, mesaj: "Entegrasyon kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath(YOL);
  return { ok: true, mesaj: id ? "Entegrasyon güncellendi." : "Entegrasyon eklendi." };
}

export async function entegrasyonSil(id: string): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  const silindi = await sil(kapsam, id);
  revalidatePath(YOL);
  return silindi
    ? { ok: true, mesaj: "Entegrasyon silindi." }
    : { ok: false, mesaj: "Entegrasyon bulunamadı." };
}

/**
 * Bağlantı testi: anahtarlar ÇÖZÜLÜR, tek kayıtlık bir istek atılır, sonuç
 * kullanıcıya cümle olarak döner. Çözülmüş anahtar bu fonksiyondan DIŞARI
 * ÇIKMAZ - dönüşte yalnız `{ok, mesaj}` vardır.
 */
export async function baglantiTest(
  id: string,
): Promise<{ ok: boolean; mesaj: string }> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ.mesaj! };

  const kimlik = await kimlikBilgileri(id, kapsam.sirketId);
  if (!kimlik) {
    return {
      ok: false,
      mesaj: "Entegrasyon bulunamadı ya da API anahtarı çözülemedi.",
    };
  }

  const istemci = trendyolIstemcisi({
    saticiId: kimlik.saticiId,
    apiKey: kimlik.apiKey,
    apiSecret: kimlik.apiSecret,
  });
  return istemci.baglantiTest();
}

/**
 * "Şimdi senkronla": kuyruğa manuel iş yazar ve zamanlayıcıyı DÜRTER.
 *
 * Dürtme `after()` ile yapılır - kullanıcı senkron bitene kadar (dakikalar)
 * beklemesin, düğme hemen cevap versin. İş kuyrukta zaten varsa yeni iş
 * açılmaz (repo kontrol eder).
 */
export async function senkronBaslat(entegrasyonId: string): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  const sonuc = await manuelIsEkle(kapsam, "siparis", entegrasyonId);
  if (!sonuc.eklendi) {
    return { ok: true, mesaj: "Bu entegrasyon için senkron zaten sırada." };
  }

  after(async () => {
    try {
      const { tik } = await import("@/lib/senkron/zamanlayici");
      await tik();
    } catch (hata) {
      console.error(
        `[senkron] manuel tetik düştü: ${hata instanceof Error ? hata.message : String(hata)}`,
      );
    }
  });

  revalidatePath(YOL);
  return { ok: true, mesaj: "Senkron başlatıldı." };
}

/** Otomatik senkron aralığı (dakika). Sınırlar repoda kırpılır (2..60). */
export async function aralikKaydet(dk: number): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  const deger = await aralikKaydetRepo(kapsam, dk);
  revalidatePath(YOL);
  return { ok: true, mesaj: `Senkron aralığı ${deger} dakika olarak kaydedildi.` };
}
