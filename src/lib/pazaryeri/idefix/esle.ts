/**
 * idefix ham sevkiyatı/ürünü → normal. SAF fonksiyonlar. Alanlar
 * `docs/pazaryeri/idefix.md`.
 *
 * SATIR = SEVKİYAT (`id`): idefix siparişi sevkiyatlara böler
 * (`shipment_split`), kargo barkodu sevkiyattadır.
 */
import { kanonikDurum } from "../durum";
import { SAAT_DILIMI_ISARETI, dilimsizMetniCoz } from "../tarih";
import type { NormalKalem, NormalSiparis, NormalUrun } from "../tipler";

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** "2022/09/30 23:59:59" (TR saati), ISO ya da epoch. */
export function tarihCoz(deger: unknown): Date | null {
  if (typeof deger === "number") {
    const d = new Date(deger);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = metin(deger);
  if (!s) return null;
  if (/^\d{10,}$/.test(s)) return new Date(Number(s));
  if (SAAT_DILIMI_ISARETI.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return dilimsizMetniCoz(s.replace(/\//g, "-"));
}

function kalemler(items: unknown): NormalKalem[] {
  if (!Array.isArray(items)) return [];
  return (items as Record<string, unknown>[]).map((k) => {
    const adet = Number(k.quantity ?? k.amount ?? 1);
    return {
      barkod: metin(k.barcode) ?? metin(k.merchantSku) ?? metin(k.erpId) ?? "",
      urunAdi: metin(k.productName) ?? metin(k.title) ?? "-",
      adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
      sku: metin(k.merchantSku),
    };
  });
}

export function sevkiyatNormalle(ham: unknown): NormalSiparis | null {
  const o = (ham ?? {}) as Record<string, unknown>;
  const siparisKimligi = metin(o.id);
  if (!siparisKimligi) return null;

  const a = ((o.shippingAddress ?? o.invoiceAddress ?? {}) as Record<string, unknown>);
  const adSoyad = [metin(a.firstName), metin(a.lastName)].filter(Boolean).join(" ");
  const hamDurum = metin(o.status);

  return {
    platform: "idefix",
    siparisKimligi,
    siparisNo: metin(o.orderNumber),
    kargoTakipNo: metin(o.cargoTrackingNumber),
    kargoFirmasi: metin(o.cargoCompany),
    hamDurum,
    durum: kanonikDurum("idefix", hamDurum),
    siparisTarihi: tarihCoz(o.orderDate ?? o.createdAt),
    musteriAd: adSoyad || metin(o.customerContactName) || "-",
    adres: {
      acik: [metin(a.neighborhood), metin(a.address1), metin(a.buildingNumber) && `No:${metin(a.buildingNumber)}`, metin(a.doorNumber) && `D:${metin(a.doorNumber)}`]
        .filter(Boolean)
        .join(" "),
      ilce: metin(a.county) ?? "",
      il: metin(a.city) ?? "",
      telefon: metin(a.phone) ?? "",
    },
    kalemler: kalemler(o.items),
    ham: o,
  };
}

export function urunEsle(ham: unknown): NormalUrun | null {
  const p = (ham ?? {}) as Record<string, unknown>;
  const barkod = metin(p.barcode);
  if (!barkod) return null;
  const gorseller = Array.isArray(p.images) ? (p.images as unknown[]) : [];
  const ilk = gorseller[0];
  return {
    barkod,
    urunAdi: metin(p.title) ?? metin(p.productName),
    gorselUrl: typeof ilk === "string" ? metin(ilk) : metin((ilk as Record<string, unknown> | undefined)?.url),
    marka: metin(p.brandName),
    kategori: metin(p.categoryName),
    stokKodu: metin(p.merchantSku) ?? metin(p.productMainId),
  };
}
