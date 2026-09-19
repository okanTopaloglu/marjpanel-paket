/**
 * Pazarama ham siparişi/ürünü → normal. SAF fonksiyonlar.
 *
 * Alan adları KISMEN doğrulandı (docs/pazaryeri/pazarama.md): her alan için
 * görülen adaylar sırayla denenir. Durum sayı ya da metin gelebilir;
 * bilinen iki kod (12 hazırlanıyor, 5 kargoda) ve Türkçe metin ipuçları
 * eşlenir, gerisi `kanonikDurum` üzerinden Created + uyarı.
 */
import { kanonikDurum } from "../durum";
import { SAAT_DILIMI_ISARETI, dilimsizMetniCoz } from "../tarih";
import type { NormalKalem, NormalSiparis, NormalUrun } from "../tipler";

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function ilkDolu(o: Record<string, unknown>, ...anahtarlar: string[]): string | null {
  for (const a of anahtarlar) {
    const v = metin(o[a]);
    if (v) return v;
  }
  return null;
}

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
  return dilimsizMetniCoz(s);
}

/**
 * Metin durumları Türkçe ipucuyla kanonik ada çevirir; sayısal ve bilinen
 * adlar `durum.ts` tablosundan geçer. Sıra önemli: "kargoya verildi" içinde
 * "verildi" var ama "teslim" yok; "teslim edilemedi" "teslim"den önce bakılır.
 */
export function durumMetniniCoz(ham: string | null): string | null {
  if (!ham) return null;
  const k = ham.toLocaleLowerCase("tr");
  if (/^\d+$/.test(k)) return k;
  if (k.includes("iptal")) return "Cancelled";
  if (k.includes("iade")) return "Returned";
  if (k.includes("teslim edilemedi") || k.includes("teslim edilemeyen")) return "UnDelivered";
  if (k.includes("teslim edildi")) return "Delivered";
  if (k.includes("kargo")) return "Shipped";
  if (k.includes("hazırlan") || k.includes("toplan")) return "Picking";
  if (k.includes("fatura")) return "Invoiced";
  if (k.includes("yeni") || k.includes("onay")) return "Created";
  return ham;
}

function kalemler(o: Record<string, unknown>): NormalKalem[] {
  const liste = [o.lines, o.orderItems, o.items].find(Array.isArray) as Record<string, unknown>[] | undefined;
  if (!liste) return [];
  return liste.map((k) => {
    const adet = Number(k.quantity ?? k.amount ?? 1);
    return {
      barkod: ilkDolu(k, "barcode", "stockCode", "sellerSku", "merchantSku", "productCode") ?? "",
      urunAdi: ilkDolu(k, "productName", "name", "displayName") ?? "-",
      adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
      sku: ilkDolu(k, "stockCode", "sellerSku", "merchantSku"),
    };
  });
}

export function siparisNormalle(ham: unknown): NormalSiparis | null {
  const o = (ham ?? {}) as Record<string, unknown>;
  const siparisKimligi = ilkDolu(o, "packageNumber", "orderNumber", "orderCode", "orderId", "id");
  if (!siparisKimligi) return null;

  const a = ((o.shippingAddress ?? o.shipmentAddress ?? o.deliveryAddress ?? {}) as Record<string, unknown>);
  const hamDurum = ilkDolu(o, "status", "orderStatus", "statusName");

  return {
    platform: "pazarama",
    siparisKimligi,
    siparisNo: ilkDolu(o, "orderNumber", "orderCode"),
    kargoTakipNo: ilkDolu(o, "cargoTrackingNumber", "trackingNumber", "shippingTrackingNumber"),
    kargoFirmasi: ilkDolu(o, "cargoCompanyName", "cargoProviderName", "cargoCompany"),
    hamDurum,
    durum: kanonikDurum("pazarama", durumMetniniCoz(hamDurum)),
    siparisTarihi: tarihCoz(o.orderDate ?? o.createdDate ?? o.lastModifiedDate),
    musteriAd:
      ilkDolu(o, "customerFullName", "customerName") ??
      [metin(a.firstName), metin(a.lastName)].filter(Boolean).join(" ") ??
      "-",
    adres: {
      acik: ilkDolu(a, "address", "addressDetail", "address1", "fullAddress") ?? "",
      ilce: ilkDolu(a, "district", "town", "county") ?? "",
      il: ilkDolu(a, "city", "cityName") ?? "",
      telefon: ilkDolu(a, "phone", "gsm", "phoneNumber") ?? "",
    },
    kalemler: kalemler(o),
    ham: o,
  };
}

export function urunEsle(ham: unknown): NormalUrun | null {
  const p = (ham ?? {}) as Record<string, unknown>;
  const barkod = ilkDolu(p, "barcode", "stockCode", "code");
  if (!barkod) return null;
  const gorseller = ([p.images, p.imageUrls].find(Array.isArray) ?? []) as unknown[];
  const ilk = gorseller[0];
  return {
    barkod,
    urunAdi: ilkDolu(p, "name", "displayName", "productName", "title"),
    gorselUrl:
      typeof ilk === "string" ? metin(ilk) : ilkDolu((ilk ?? {}) as Record<string, unknown>, "url", "imageUrl"),
    marka: ilkDolu(p, "brandName", "brand"),
    kategori: ilkDolu(p, "categoryName", "category"),
    stokKodu: ilkDolu(p, "stockCode", "code"),
  };
}
