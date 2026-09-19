"use server";

import { revalidatePath } from "next/cache";
import { adminKapsami } from "@/lib/auth/yetki";
import {
  ASGARI_SILME_GUNU,
  detay,
  eskileriSil as eskileriSilRepo,
  yazdirildiIsaretle as yazdirildiIsaretleRepo,
  type SiparisDetayi,
} from "@/lib/db/repos/siparisler";
import type { EylemDurumu } from "./auth";

/**
 * SİPARİŞ EYLEMLERİ — yalnız yönetici.
 *
 * Etiket sayfası ayrı bir sekmede (yazdırma katmanı) açıldığı için işaretleme
 * eylemini ORADAN çağırır; kapı bu yüzden eylemin kendisinde durur.
 */

const YETKISIZ: EylemDurumu = {
  ok: false,
  mesaj: "Bu işlem için yönetici yetkisi gerekli.",
};

const YOL = "/siparisler";

/** Etiket basıldı: listedeki "Yazdırıldı" sütunu bunu okur. */
export async function yazdirildiIsaretle(ids: string[]): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  const adet = await yazdirildiIsaretleRepo(kapsam, ids);
  revalidatePath(YOL);
  return adet > 0
    ? { ok: true, mesaj: `${adet} sipariş yazdırıldı olarak işaretlendi.` }
    : { ok: false, mesaj: "İşaretlenecek sipariş bulunamadı." };
}

/**
 * Eski siparişleri siler. Alt sınır 7 gün (PartnerSys ile aynı); ayrıca
 * hazırlanmamış ve nihai duruma gelmemiş satırlar hiç silinmez (bkz. repo).
 */
export async function eskileriSil(gun: number): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return YETKISIZ;

  if (!Number.isFinite(gun) || gun < ASGARI_SILME_GUNU) {
    return { ok: false, mesaj: `En az ${ASGARI_SILME_GUNU} gün girilmeli.` };
  }

  const adet = await eskileriSilRepo(kapsam, gun);
  revalidatePath(YOL);
  return { ok: true, mesaj: `${adet} sipariş silindi.` };
}

/**
 * Sipariş detayı (satır açıldığında).
 *
 * NEDEN EYLEM, NEDEN LİSTEDE DEĞİL: detay ürün görsellerini `urunler`
 * tablosundan çeker; bunu liste sorgusuna katmak 50 satırlık sayfada her
 * yenilemede gereksiz bir join demekti. Kullanıcı satırı açtığında tek kayıt
 * için tek sorgu atılır. Dönüşte HAM VERİ YOKTUR - repo yalnız süzülmüş
 * alanları verir (bkz. repos/siparisler başlığı).
 */
export async function siparisDetayi(id: string): Promise<SiparisDetayi | null> {
  const kapsam = await adminKapsami();
  if (!kapsam) return null;
  return detay(kapsam, id);
}
