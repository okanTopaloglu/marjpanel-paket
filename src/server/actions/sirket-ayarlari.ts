"use server";

import { revalidatePath } from "next/cache";
import { adminKapsami } from "@/lib/auth/yetki";
import { sevkKesimSaatiAyarla } from "@/lib/db/repos/sirketler";
import type { EylemDurumu } from "./auth";

/** ŞİRKET AYARLARI (yönetici): sevk kesim saati. */
export async function sevkKesimSaatiKaydet(saat: number): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: "Bu işlem için yetkiniz yok." };
  if (!Number.isInteger(saat) || saat < 0 || saat > 23) return { ok: false, mesaj: "Saat 0-23 arasında olmalı." };

  const deger = await sevkKesimSaatiAyarla(kapsam.sirketId, saat);
  revalidatePath("/");
  revalidatePath("/ayarlar");
  revalidatePath("/siparisler");
  return { ok: true, mesaj: `Sevk kesim saati ${String(deger).padStart(2, "0")}:00 olarak kaydedildi.` };
}
