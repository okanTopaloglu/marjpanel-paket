import {
  SIPARIS_DURUMLARI,
  durumNormalize,
  type SiparisDurumu,
} from "@/lib/siparis/sabitler";
import type { Platform } from "./tipler";

/**
 * KANONİK DURUM EŞLEMESİ — her pazaryerinin ham durumu tek kümeye iner.
 *
 * Veritabanındaki `durum` sütunu Trendyol adlarıyla doğdu (Created, Picking,
 * Shipped…) ve sekme SQL'i, toplama havuzu, 17:00 kesimi bu adlara bakar.
 * Yeni pazaryerleri kendi adlarını buraya eşler; SQL değişmez.
 *
 * BİLİNMEYEN DURUM: `Created` sayılır ama BİR KEZ uyarı loglanır (değer
 * başına). Sessizce Created saymak tehlikelidir — tanınmayan bir "iptal"
 * durumu havuza girer ve depo iptal siparişi paketler. Log, eksik satırı
 * tabloya ekletir. Her tablonun bilinen tüm durumları kapsadığı testle
 * korunur (`durum.test.ts`).
 */
type DurumTablosu = Readonly<Record<string, SiparisDurumu>>;

/** Trendyol: veritabanı adları zaten Trendyol'unki; birebir. */
const TRENDYOL: DurumTablosu = Object.fromEntries(
  SIPARIS_DURUMLARI.map((d) => [d, d]),
) as DurumTablosu;

/** N11 REST sipariş ucu Trendyol adlarını kullanır (docs/pazaryeri/n11.md). */
const N11: DurumTablosu = { ...TRENDYOL };

/**
 * Hepsiburada paket durumları (docs/pazaryeri/hepsiburada.md; spec enum
 * vermiyor, küme canlı hesapla doğrulanmalı). "Unpacked" bozulan pakettir:
 * barkodu artık geçersiz, okutulmasın diye Cancelled sayılır.
 */
const HEPSIBURADA: DurumTablosu = {
  Open: "Created",
  Created: "Created",
  Packaged: "Picking",
  Picking: "Picking",
  ReadyToShip: "Picking",
  Prepared: "Picking",
  Shipped: "Shipped",
  InTransit: "Shipped",
  Intransit: "Shipped",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
  Canceled: "Cancelled",
  CancelledByMerchant: "Cancelled",
  CancelledByHb: "Cancelled",
  Unpacked: "Cancelled",
  Returned: "Returned",
  UnDelivered: "UnDelivered",
  Undelivered: "UnDelivered",
};

/** idefix sevkiyat durumları — belgeden (docs/pazaryeri/idefix.md). */
const IDEFIX: DurumTablosu = {
  created: "Created",
  shipment_ready: "Created",
  shipment_picking: "Picking",
  shipment_split: "Picking",
  shipment_invoiced: "Invoiced",
  shipment_in_cargo: "Shipped",
  shipment_delivered: "Delivered",
  shipment_approved: "Delivered",
  shipment_undeliver: "UnDelivered",
  shipment_cancelled: "Cancelled",
  shipment_unsupplied: "UnSupplied",
};

/**
 * Pazarama: sayısal kodlar KISMEN bilinir (docs/pazaryeri/pazarama.md); metin
 * durumlar önce `pazarama/esle.durumMetniniCoz` ile kanonik ada çevrilir,
 * o adlar da burada kendine eşlenir.
 */
const PAZARAMA: DurumTablosu = {
  ...TRENDYOL,
  "12": "Picking", // Siparişiniz Hazırlanıyor
  "5": "Shipped", // Siparişiniz Kargoya Verildi
};

export const DURUM_TABLOLARI: Partial<Record<Platform, DurumTablosu>> = {
  trendyol: TRENDYOL,
  n11: N11,
  hepsiburada: HEPSIBURADA,
  idefix: IDEFIX,
  pazarama: PAZARAMA,
};

const uyarilan = new Set<string>();

export function kanonikDurum(platform: Platform, ham: string | null | undefined): SiparisDurumu {
  const d = (ham ?? "").trim();
  if (!d) return "Created";

  const tablo = DURUM_TABLOLARI[platform];
  const eslenen = tablo?.[d];
  if (eslenen) return eslenen;

  // Tabloda yoksa beyaz listedeki bir ad olabilir (bazı platformlar Trendyol
  // adlarını kullanır); değilse Created + uyarı.
  const normal = durumNormalize(d);
  const anahtar = `${platform}:${d}`;
  if (normal === "Created" && d !== "Created" && !uyarilan.has(anahtar)) {
    uyarilan.add(anahtar);
    console.warn(
      `[pazaryeri] ${platform}: tanınmayan sipariş durumu "${d}" → Created sayıldı. lib/pazaryeri/durum.ts tablosuna ekleyin.`,
    );
  }
  return normal;
}
