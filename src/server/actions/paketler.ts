"use server";

import { revalidatePath } from "next/cache";
import { adminKapsami } from "@/lib/auth/yetki";
import { sil, topluSil } from "@/lib/db/repos/paketler";

/**
 * PAKET SİLME EYLEMLERİ - yalnız yönetici.
 *
 * Yetki kapısı `adminKapsami`: çalışan kendi okutmasını bile silemez, çünkü
 * silme burada bir "hata düzeltme" işlemidir (yanlış barkod okutuldu) ve
 * kaydın kaybolması vardiya sayımını değiştirir. Repo katmanı rolü İKİNCİ
 * kez kontrol eder - bu dosya atlansa da kural ayakta kalır.
 *
 * `revalidatePath` silmeden sonra listeyi tazeler; ekran kendi durumunu
 * elle düzeltmek zorunda kalmaz.
 */

export type SilmeCevabi =
  | { ok: true; silinen: number }
  | { ok: false; hata: string };

const YETKI_HATASI = "Bu işlem için yönetici olmanız gerekir.";

export async function paketSil(id: string): Promise<SilmeCevabi> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, hata: YETKI_HATASI };

  const kimlik = (id ?? "").trim();
  if (!kimlik) return { ok: false, hata: "Silinecek paket belirtilmedi." };

  const silinen = await sil(kapsam, kimlik);
  revalidatePath("/paketler");
  return { ok: true, silinen };
}

export async function paketleriSil(idler: string[]): Promise<SilmeCevabi> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, hata: YETKI_HATASI };

  const temiz = [...new Set((idler ?? []).map((i) => (i ?? "").trim()))].filter(
    Boolean,
  );
  if (temiz.length === 0) {
    return { ok: false, hata: "Silinecek paket seçilmedi." };
  }

  const silinen = await topluSil(kapsam, temiz);
  revalidatePath("/paketler");
  return { ok: true, silinen };
}
