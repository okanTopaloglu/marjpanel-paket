/**
 * Amazon Orders v0 ham siparişi → normal. SAF fonksiyonlar.
 *
 * KARAR: `kargoTakipNo = AmazonOrderId`. MFN siparişinde takip numarası
 * satıcı kargolayınca doğar ve SP-API'de gelmez; depo etiketi sipariş
 * numarasıyla basar ve onu okutur (docs/pazaryeri/amazon.md, kullanıcıyla
 * doğrulanacak).
 */
import { kanonikDurum } from "../durum";
import type { NormalKalem, NormalSiparis } from "../tipler";
import type { HamKalem, HamSiparis } from "./istemci";

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function kalemleriNormalle(items: HamKalem[]): NormalKalem[] {
  return items.map((k) => {
    const adet = Number(k.QuantityOrdered ?? 1);
    return {
      barkod: metin(k.SellerSKU) ?? metin(k.ASIN) ?? "",
      urunAdi: metin(k.Title) ?? "-",
      adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
      sku: metin(k.SellerSKU),
    };
  });
}

export function siparisNormalle(ham: HamSiparis, kalemler: NormalKalem[]): NormalSiparis | null {
  const id = metin(ham.AmazonOrderId);
  if (!id) return null;
  const a = (ham.ShippingAddress ?? {}) as Record<string, unknown>;
  const alici = (ham.BuyerInfo ?? {}) as Record<string, unknown>;
  const hamDurum = metin(ham.OrderStatus);
  const tarih = metin(ham.PurchaseDate);
  const d = tarih ? new Date(tarih) : null;

  return {
    platform: "amazon",
    siparisKimligi: id,
    siparisNo: id,
    kargoTakipNo: id,
    kargoFirmasi: metin(ham.FulfillmentChannel) === "AFN" ? "Amazon (FBA)" : null,
    hamDurum,
    durum: kanonikDurum("amazon", hamDurum),
    siparisTarihi: d && !Number.isNaN(d.getTime()) ? d : null,
    musteriAd: metin(a.Name) ?? metin(alici.BuyerName) ?? "-",
    adres: {
      acik: [metin(a.AddressLine1), metin(a.AddressLine2), metin(a.AddressLine3)].filter(Boolean).join(" "),
      ilce: metin(a.County) ?? metin(a.District) ?? "",
      il: metin(a.City) ?? metin(a.StateOrRegion) ?? "",
      telefon: metin(a.Phone) ?? "",
    },
    kalemler,
    ham: { ...ham, OrderItems: kalemler },
  };
}
