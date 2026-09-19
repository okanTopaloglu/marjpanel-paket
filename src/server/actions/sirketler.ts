"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminKapsami, superKapsami } from "@/lib/auth/yetki";
import { alanHatalari } from "@/lib/form/alan-hatalari";
import { dosyaKaydet, dosyaSil } from "@/lib/depo/dosya";
import { CakismaHatasi, guncelle, logoAyarla, olustur, sil } from "@/lib/db/repos/sirketler";
import { kiraciOnbellegiTemizle, platformHostu } from "@/lib/kiraci/coz";
import { alanAdiNormalize } from "@/lib/kiraci/kural";
import type { EylemDurumu } from "./auth";

/**
 * ŞİRKET (PLATFORM) YÖNETİMİ — server action'lar. Kapı `superKapsami()`:
 * yalnız super_admin. Bu ekran platformun tamamını gördüğü için kiracı
 * izolasyonu burada YOKTUR — tersine, süper yönetici kasıtlı olarak tüm
 * şirketlere erişir.
 *
 * LOGO eylemleri ayrıdır ve iki kapısı vardır: super_admin herhangi bir
 * şirket için, admin yalnız KENDİ şirketi için (Ayarlar → Şirket markası).
 */

const YETKISIZ_MESAJI = "Bu işlem için yetkiniz yok.";
const DUZELT_MESAJI = "Lütfen işaretli alanları düzeltin.";

/** Checkbox'lar işaretliyken "on", işaretsizken formdan hiç gelmez. */
const kutuSemasi = z
  .union([z.literal("on"), z.literal(""), z.null()])
  .optional()
  .transform((d) => d === "on");

const semasi = z.object({
  id: z.union([z.string().uuid(), z.literal("")]),
  ad: z
    .string()
    .trim()
    .min(2, "Şirket adı en az 2 karakter olmalı.")
    .max(80, "Şirket adı en fazla 80 karakter olabilir."),
  markaAdi: z.string().trim().max(40, "Marka adı en fazla 40 karakter olabilir."),
  alanAdi: z.string().trim().max(255, "Alan adı en fazla 255 karakter olabilir."),
  azamiEntegrasyon: z.string().trim(),
  faturaPaylasAcik: kutuSemasi,
  faturaKesimAcik: kutuSemasi,
  mailAcik: kutuSemasi,
});

/** Şirket oluşturur ya da (gizli `id` alanı doluysa) günceller. */
export async function sirketKaydetForm(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await superKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = semasi.safeParse({
    id: formData.get("id") ?? "",
    ad: formData.get("ad"),
    markaAdi: formData.get("markaAdi") ?? "",
    alanAdi: formData.get("alanAdi") ?? "",
    azamiEntegrasyon: formData.get("azamiEntegrasyon") ?? "",
    faturaPaylasAcik: formData.get("faturaPaylasAcik"),
    faturaKesimAcik: formData.get("faturaKesimAcik"),
    mailAcik: formData.get("mailAcik"),
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
  }

  // Alan adı: boş = platformdan girer; doluysa geçerli bir host olmalı ve
  // platform adresi olamaz (kiracı platformun adresini kapatamaz).
  let alanAdi: string | null = null;
  if (cozum.data.alanAdi !== "") {
    alanAdi = alanAdiNormalize(cozum.data.alanAdi);
    if (!alanAdi) {
      return {
        ok: false,
        mesaj: DUZELT_MESAJI,
        alanlar: { alanAdi: "Geçerli bir alan adı yazın (örn. sirket.marjpanel.com)." },
      };
    }
    if (alanAdi === platformHostu()) {
      return { ok: false, mesaj: DUZELT_MESAJI, alanlar: { alanAdi: "Bu adres platforma ait." } };
    }
  }

  // Boş = sınırsız; doluysa negatif olmayan bir tam sayı olmalı.
  let azami: number | null = null;
  if (cozum.data.azamiEntegrasyon !== "") {
    const n = Number(cozum.data.azamiEntegrasyon);
    if (!Number.isInteger(n) || n < 0) {
      return {
        ok: false,
        mesaj: DUZELT_MESAJI,
        alanlar: { azamiEntegrasyon: "Tam sayı girin ya da sınırsız için boş bırakın." },
      };
    }
    azami = n;
  }

  const girdi = {
    ad: cozum.data.ad,
    alanAdi,
    markaAdi: cozum.data.markaAdi === "" ? null : cozum.data.markaAdi,
    azamiEntegrasyon: azami,
    faturaPaylasAcik: cozum.data.faturaPaylasAcik,
    faturaKesimAcik: cozum.data.faturaKesimAcik,
    mailAcik: cozum.data.mailAcik,
  };

  try {
    if (cozum.data.id) {
      await guncelle(cozum.data.id, girdi);
    } else {
      const yeni = await olustur({ ad: girdi.ad, alanAdi: girdi.alanAdi });
      await guncelle(yeni.id, {
        markaAdi: girdi.markaAdi,
        azamiEntegrasyon: girdi.azamiEntegrasyon,
        faturaPaylasAcik: girdi.faturaPaylasAcik,
        faturaKesimAcik: girdi.faturaKesimAcik,
        mailAcik: girdi.mailAcik,
      });
    }
  } catch (hata) {
    if (hata instanceof CakismaHatasi) {
      if (hata.alan === "sirketAd") {
        return {
          ok: false,
          mesaj: DUZELT_MESAJI,
          alanlar: { ad: "Bu şirket adı zaten kullanılıyor." },
        };
      }
      if (hata.alan === "alanAdi") {
        return {
          ok: false,
          mesaj: DUZELT_MESAJI,
          alanlar: { alanAdi: "Bu alan adı zaten kullanılıyor." },
        };
      }
    }
    throw hata;
  }

  kiraciOnbellegiTemizle();
  revalidatePath("/sirketler");
  revalidatePath("/", "layout");
  return { ok: true, mesaj: cozum.data.id ? "Şirket güncellendi." : "Şirket oluşturuldu." };
}

/** Şirketi siler. Süper yönetici KENDİ şirketini silemez (o an yönetimsiz kalırdı). */
export async function sirketSil(id: string): Promise<EylemDurumu> {
  const kapsam = await superKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  if (id === kapsam.sirketId) {
    return { ok: false, mesaj: "Kendi şirketinizi silemezsiniz." };
  }

  await sil(id);
  kiraciOnbellegiTemizle();
  revalidatePath("/sirketler");
  revalidatePath("/");
  return { ok: true, mesaj: "Şirket silindi." };
}

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */

const IZINLI_TURLER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
/** Logo küçük olmalı; 1 MB üstü zaten yanlış dosyadır (fotoğraf). */
const AZAMI_LOGO_BOYUT = 1024 * 1024;

/**
 * Hangi şirketin logosuna dokunulabilir: super_admin formdaki `sirketId`
 * (boşsa kendi), admin YALNIZ kendi şirketi — formdan gelen kimlik okunmaz.
 */
async function logoHedefi(formSirketId: string): Promise<string | null> {
  const k = await adminKapsami();
  if (!k) return null;
  if (k.rol === "super_admin") return formSirketId || k.sirketId;
  return k.sirketId;
}

function turCoz(v: FormDataEntryValue | null): "acik" | "koyu" | null {
  return v === "acik" || v === "koyu" ? v : null;
}

/**
 * Logo yükler (`gorsel`, `tur`: acik|koyu, `sirketId` yalnız super_admin
 * için). İSTEMCİDE SIKIŞTIRILMAZ: logo saydam PNG olabilir, JPEG'e çevirmek
 * saydamlığı öldürürdü. Boyut sınırı bunun bedelidir.
 */
export async function sirketLogoYukle(formData: FormData): Promise<EylemDurumu> {
  const sirketId = await logoHedefi(String(formData.get("sirketId") ?? ""));
  if (!sirketId) return { ok: false, mesaj: YETKISIZ_MESAJI };
  const tur = turCoz(formData.get("tur"));
  if (!tur) return { ok: false, mesaj: "Logo türü geçersiz." };

  const dosya = formData.get("gorsel");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { ok: false, mesaj: "Lütfen bir görsel seçin." };
  }
  const uzanti = IZINLI_TURLER[dosya.type];
  if (!uzanti) return { ok: false, mesaj: "Yalnız PNG, WEBP ya da JPEG kabul edilir (saydam PNG önerilir)." };
  if (dosya.size > AZAMI_LOGO_BOYUT) return { ok: false, mesaj: "Logo en fazla 1 MB olabilir." };

  const dosyaAdi = await dosyaKaydet(Buffer.from(await dosya.arrayBuffer()), uzanti);
  const eski = await logoAyarla(sirketId, tur, dosyaAdi);
  if (eski) await dosyaSil(eski);

  kiraciOnbellegiTemizle();
  revalidatePath("/", "layout");
  return { ok: true, mesaj: tur === "acik" ? "Logo güncellendi." : "Koyu zemin logosu güncellendi." };
}

export async function sirketLogoSil(formSirketId: string, tur: "acik" | "koyu"): Promise<EylemDurumu> {
  const sirketId = await logoHedefi(formSirketId);
  if (!sirketId) return { ok: false, mesaj: YETKISIZ_MESAJI };
  if (!turCoz(tur)) return { ok: false, mesaj: "Logo türü geçersiz." };

  const eski = await logoAyarla(sirketId, tur, null);
  if (eski) await dosyaSil(eski);

  kiraciOnbellegiTemizle();
  revalidatePath("/", "layout");
  return { ok: true, mesaj: "Logo kaldırıldı." };
}
