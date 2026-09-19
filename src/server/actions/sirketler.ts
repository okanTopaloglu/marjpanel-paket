"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { superKapsami } from "@/lib/auth/yetki";
import { alanHatalari } from "@/lib/form/alan-hatalari";
import { CakismaHatasi, guncelle, olustur, sil } from "@/lib/db/repos/sirketler";
import type { EylemDurumu } from "./auth";

/**
 * ŞİRKET (PLATFORM) YÖNETİMİ — server action'lar. Kapı `superKapsami()`:
 * yalnız super_admin. Bu ekran platformun tamamını gördüğü için kiracı
 * izolasyonu burada YOKTUR — tersine, süper yönetici kasıtlı olarak tüm
 * şirketlere erişir.
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
    alanAdi: formData.get("alanAdi") ?? "",
    azamiEntegrasyon: formData.get("azamiEntegrasyon") ?? "",
    faturaPaylasAcik: formData.get("faturaPaylasAcik"),
    faturaKesimAcik: formData.get("faturaKesimAcik"),
    mailAcik: formData.get("mailAcik"),
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
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
    alanAdi: cozum.data.alanAdi === "" ? null : cozum.data.alanAdi,
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

  revalidatePath("/sirketler");
  revalidatePath("/");
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
  revalidatePath("/sirketler");
  revalidatePath("/");
  return { ok: true, mesaj: "Şirket silindi." };
}
