"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminKapsami } from "@/lib/auth/yetki";
import { alanHatalari } from "@/lib/form/alan-hatalari";
import {
  KuralCakismasi,
  KuralYetkisi,
  KuralYok,
  aktiflikDegistir,
  kaydet,
  sil,
} from "@/lib/db/repos/barkod-kurallari";
import type { EylemDurumu } from "./auth";

/**
 * BARKOD KURALI EYLEMLERİ.
 *
 * Kural yönetimi okutmanın DAVRANIŞINI değiştirir: yanlış bir önek bütün bir
 * vardiyanın paketlerini yanlış kargoya yazar. Bu yüzden kapı `adminKapsami()`
 * ve kapsam kararı (global mi şirket mi) REPO katmanındadır - bu dosya yalnız
 * formu ayrıştırır ve hatayı kullanıcının diline çevirir.
 */

const YETKISIZ_MESAJI = "Bu işlem için yetkiniz yok.";
const DUZELT_MESAJI = "Lütfen işaretli alanları düzeltin.";

const kuralSemasi = z.object({
  id: z.union([z.string().uuid(), z.literal("")]),
  barkodOneki: z
    .string()
    .trim()
    .min(1, "Barkod öneki gerekli.")
    .max(32, "Barkod öneki en fazla 32 karakter olabilir.")
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Önek yalnız harf, rakam, nokta, alt çizgi ve kısa çizgi içerebilir.",
    ),
  kaynak: z
    .string()
    .trim()
    .min(1, "Kaynak gerekli.")
    .max(60, "Kaynak en fazla 60 karakter olabilir."),
  kargoFirmasi: z
    .string()
    .trim()
    .min(1, "Kargo firması gerekli.")
    .max(60, "Kargo firması en fazla 60 karakter olabilir."),
  oncelik: z.coerce
    .number({ invalid_type_error: "Öncelik bir sayı olmalı." })
    .int("Öncelik tam sayı olmalı.")
    .min(1, "Öncelik en az 1 olabilir.")
    .max(9999, "Öncelik en fazla 9999 olabilir."),
  aciklama: z.string().trim().max(300, "Açıklama en fazla 300 karakter olabilir."),
  aktif: z.boolean(),
  global: z.boolean(),
});

/** Repo hatalarını forma çevirir; tanımadıklarını yeniden fırlatır. */
function kuralHatasiniCevir(hata: unknown): EylemDurumu {
  if (hata instanceof KuralCakismasi) {
    return {
      ok: false,
      mesaj: DUZELT_MESAJI,
      alanlar: { barkodOneki: hata.message },
    };
  }
  if (hata instanceof KuralYetkisi || hata instanceof KuralYok) {
    return { ok: false, mesaj: hata.message };
  }
  throw hata;
}

/** Onay kutusu değeri: işaretliyse "on"/"1", değilse alan hiç gelmez. */
function isaretli(deger: FormDataEntryValue | null): boolean {
  return deger === "on" || deger === "1" || deger === "true";
}

export async function kuralKaydet(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = kuralSemasi.safeParse({
    id: formData.get("id") ?? "",
    barkodOneki: formData.get("barkodOneki") ?? "",
    kaynak: formData.get("kaynak") ?? "",
    kargoFirmasi: formData.get("kargoFirmasi") ?? "",
    oncelik: formData.get("oncelik") ?? "",
    aciklama: formData.get("aciklama") ?? "",
    aktif: isaretli(formData.get("aktif")),
    global: isaretli(formData.get("global")),
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
  }

  const yeniMi = cozum.data.id === "";

  try {
    await kaydet(kapsam, {
      id: cozum.data.id || undefined,
      barkodOneki: cozum.data.barkodOneki,
      kaynak: cozum.data.kaynak,
      kargoFirmasi: cozum.data.kargoFirmasi,
      oncelik: cozum.data.oncelik,
      aktif: cozum.data.aktif,
      aciklama: cozum.data.aciklama,
      global: cozum.data.global,
    });
  } catch (hata) {
    return kuralHatasiniCevir(hata);
  }

  revalidatePath("/barkod-kurallari");
  return { ok: true, mesaj: yeniMi ? "Kural eklendi." : "Kural güncellendi." };
}

export async function kuralSil(id: string): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  try {
    await sil(kapsam, (id ?? "").trim());
  } catch (hata) {
    return kuralHatasiniCevir(hata);
  }

  revalidatePath("/barkod-kurallari");
  return { ok: true, mesaj: "Kural silindi." };
}

export async function kuralAktiflik(
  id: string,
  aktif: boolean,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  try {
    await aktiflikDegistir(kapsam, (id ?? "").trim(), aktif);
  } catch (hata) {
    return kuralHatasiniCevir(hata);
  }

  revalidatePath("/barkod-kurallari");
  return { ok: true, mesaj: aktif ? "Kural aktifleştirildi." : "Kural pasifleştirildi." };
}
