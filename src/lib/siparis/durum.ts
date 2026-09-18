/**
 * Sipariş görünen durumu ve sekme koşulları. PartnerSys
 * `deriveDisplayStatus`/`buildStatusWhere` portu; SQL koşulları
 * repos/siparisler içinde bu tanımdan üretilir.
 */
import { KARGOLANMIS_DURUMLAR } from "./sabitler";

export const GORUNEN_DURUMLAR = [
  "bekleyen",
  "hazir",
  "kargoda",
  "iptal",
] as const;
export type GorunenDurum = (typeof GORUNEN_DURUMLAR)[number];

export const GORUNEN_DURUM_ETIKETI: Record<GorunenDurum, string> = {
  bekleyen: "Bekleyen",
  hazir: "Hazır paketler",
  kargoda: "Kargoya verildi",
  iptal: "İptal edilenler",
};

/** Sekme filtreleri: görünen dört durum + iki özel kesit. */
export const SEKMELER = [
  "tumu",
  "bekleyen",
  "bekleyen_kargo",
  "hazir",
  "kargoda",
  "iptal",
  "sevk_gecikmis",
] as const;
export type Sekme = (typeof SEKMELER)[number];

export const SEKME_ETIKETI: Record<Sekme, string> = {
  tumu: "Tümü",
  bekleyen: "Bekleyen",
  bekleyen_kargo: "Kargo bekleyen",
  hazir: "Hazır",
  kargoda: "Kargoda",
  iptal: "İptal",
  sevk_gecikmis: "17:00 öncesi sevk edilmemiş",
};

export function sekmeMi(v: string | null | undefined): v is Sekme {
  return (SEKMELER as readonly string[]).includes(v ?? "");
}

export function gorunenDurum(
  durum: string,
  hazirZamani: Date | null,
  kargoTakipNo: string | null,
): GorunenDurum {
  if ((KARGOLANMIS_DURUMLAR as readonly string[]).includes(durum) && kargoTakipNo)
    return "kargoda";
  if (hazirZamani && !["Shipped", "Delivered", "Cancelled"].includes(durum))
    return "hazir";
  if (durum === "Cancelled") return "iptal";
  return "bekleyen";
}

/** Okutma kararı: sipariş bulunduğunda okutmayı engelleyen durum. */
export type OkutmaEngeli = "iptal" | "kargolanmis" | null;
export function okutmaEngeli(durum: string): OkutmaEngeli {
  if (durum === "Cancelled") return "iptal";
  if ((KARGOLANMIS_DURUMLAR as readonly string[]).includes(durum)) return "kargolanmis";
  return null;
}
