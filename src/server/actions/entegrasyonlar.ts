"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { adminKapsami } from "@/lib/auth/yetki";
import {
  EntegrasyonCakismasi,
  EntegrasyonLimiti,
  EntegrasyonYok,
  PlatformGecersiz,
  aralikKaydet as aralikKaydetRepo,
  kaydet,
  kimlikBilgileri,
  listele,
  sil,
} from "@/lib/db/repos/entegrasyonlar";
import { manuelIsEkle } from "@/lib/db/repos/senkron-isleri";
import { PAZARYERLERI, platformMi } from "@/lib/pazaryeri/kayit";
import { kimlikSemasi, type Kimlik } from "@/lib/pazaryeri/kimlik";
import { SaglayiciYok, saglayiciAl } from "@/lib/pazaryeri/saglayici";
import type { Platform } from "@/lib/pazaryeri/tipler";
import type { EylemDurumu } from "./auth";

/**
 * ENTEGRASYON EYLEMLERİ — yalnız yönetici.
 *
 * Her eylem kapıyı KENDİ açar (`adminKapsami`): sayfanın kapısı yeterli
 * değildir, eylem doğrudan çağrılabilir (eski sekme, devtools, betik).
 *
 * KİMLİK BİLGİSİ DÖNÜŞLERDE ASLA GEÇMEZ. Formdan yukarı çıkar, şifrelenip
 * veritabanına yazılır; aşağı yalnız maskeli hâli iner (repo maskeler).
 *
 * PLATFORM SEÇİMLİDİR: form alanları `lib/pazaryeri/kayit` tanımından
 * üretilir, doğrulama aynı tanımdan (`kimlikSemasi`) gelir.
 */

const YETKISIZ: EylemDurumu = {
  ok: false,
  mesaj: "Bu işlem için yönetici yetkisi gerekli.",
};

const YOL = "/entegrasyonlar";

const ortakSema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  platform: z.string().trim(),
  // Ad İSTEĞE BAĞLI: tek mağazası olan kullanıcı ad vermek zorunda değil,
  // boşsa liste platform adına düşer.
  ad: z.string().trim().max(60, "Mağaza adı en fazla 60 karakter olabilir.").optional(),
});

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path[0];
    if (typeof alan === "string" && !cikti[alan]) cikti[alan] = sorun.message;
  }
  return cikti;
}

/** Düzenlemede platform formdan değil KAYITTAN okunur (değiştirilemez). */
async function platformuCoz(
  sirketId: string,
  id: string | undefined,
  formdaki: string,
): Promise<Platform | null> {
  if (id) {
    const kayit = (await listele(sirketId)).find((e) => e.id === id);
    return kayit?.platform ?? null;
  }
  return platformMi(formdaki) && PAZARYERLERI[formdaki].hazir ? formdaki : null;
}

/**
 * Ekler ya da günceller.
 *
 * GİZLİ ALANLAR YENİ KAYITTA ZORUNLU, DÜZENLEMEDE İSTEĞE BAĞLIDIR: form
 * anahtarı maskeli gösterir, kullanıcı yalnız adı değiştirmek için
 * kaydettiğinde alan boştur ve boş "değiştirme" demektir (repo eskisini korur).
 */
export async function entegrasyonKaydet(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  const ortak = ortakSema.safeParse({
    id: formData.get("id") ?? "",
    platform: formData.get("platform") ?? "",
    ad: formData.get("ad") ?? "",
  });
  if (!ortak.success) return { ok: false, alanlar: alanHatalari(ortak.error) };

  const id = ortak.data.id || undefined;
  const platform = await platformuCoz(kapsam.sirketId, id, ortak.data.platform);
  if (!platform) {
    return { ok: false, mesaj: "Pazaryeri seçilmedi ya da bu pazaryeri henüz hazır değil." };
  }

  const hamKimlik: Record<string, unknown> = {};
  for (const alan of PAZARYERLERI[platform].alanlar) {
    hamKimlik[alan.ad] = formData.get(alan.ad) ?? "";
  }
  const kimlikAyristirma = kimlikSemasi(platform, !!id).safeParse(hamKimlik);
  if (!kimlikAyristirma.success) {
    return { ok: false, alanlar: alanHatalari(kimlikAyristirma.error) };
  }
  const kimlik: Kimlik = {};
  for (const [k, v] of Object.entries(kimlikAyristirma.data)) {
    if (typeof v === "string") kimlik[k] = v;
  }

  try {
    await kaydet(kapsam, { id, platform, ad: ortak.data.ad ?? null, kimlik });
  } catch (hata) {
    if (hata instanceof EntegrasyonCakismasi) {
      return { ok: false, alanlar: { [PAZARYERLERI[platform].hesapKimligiAlani]: hata.message } };
    }
    if (
      hata instanceof EntegrasyonLimiti ||
      hata instanceof EntegrasyonYok ||
      hata instanceof PlatformGecersiz
    ) {
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
 * Bağlantı testi: kimlik ÇÖZÜLÜR, sağlayıcı tek kayıtlık bir istek atar,
 * sonuç kullanıcıya cümle olarak döner. Çözülmüş kimlik bu fonksiyondan
 * DIŞARI ÇIKMAZ - dönüşte yalnız `{ok, mesaj}` vardır.
 */
export async function baglantiTest(id: string): Promise<{ ok: boolean; mesaj: string }> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ.mesaj! };

  const kimlik = await kimlikBilgileri(id, kapsam.sirketId);
  if (!kimlik) {
    return {
      ok: false,
      mesaj: "Entegrasyon bulunamadı ya da kimlik bilgileri çözülemedi.",
    };
  }

  try {
    return await saglayiciAl(kimlik).baglantiTest();
  } catch (hata) {
    if (hata instanceof SaglayiciYok) return { ok: false, mesaj: hata.message };
    return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
  }
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
