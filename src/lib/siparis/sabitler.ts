/** Pazaryeri ham durumları. Trendyol'un verdiği adlar korunur (beyaz liste). */
export const SIPARIS_DURUMLARI = [
  "Created",
  "Picking",
  "Invoiced",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Returned",
  "UnDelivered",
  "AtCollectionPoint",
  "UnSupplied",
] as const;
export type SiparisDurumu = (typeof SIPARIS_DURUMLARI)[number];

/** Toplama/okutma havuzuna girebilen durumlar. */
export const BEKLEYEN_DURUMLAR = ["Created", "Picking", "Invoiced"] as const;

/** Bir kez bu duruma gelen sipariş senkronda bir daha güncellenmez. */
export const NIHAI_DURUMLAR = ["Shipped", "Delivered", "Cancelled", "Returned"] as const;

/** Okutmayı engelleyen durumlar. */
export const KARGOLANMIS_DURUMLAR = ["Shipped", "Delivered"] as const;

export const ISTANBUL_TZ = "Europe/Istanbul";

/** Günlük sevk kesim saati (Trendyol "bugün kargoya ver" eşiği). */
export const SEVK_KESIM_SAATI = 17;

export function durumNormalize(ham: string | null | undefined): SiparisDurumu {
  const d = (ham ?? "").trim();
  return (SIPARIS_DURUMLARI as readonly string[]).includes(d)
    ? (d as SiparisDurumu)
    : "Created";
}
