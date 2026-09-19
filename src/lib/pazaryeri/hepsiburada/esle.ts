/**
 * Hepsiburada ham paketi/ürünü → normal. SAF fonksiyonlar. Alan adları
 * `docs/pazaryeri/hepsiburada.md` (spec: ExternalRawPackageRepresentation,
 * IntegratorProductInformation).
 *
 * SATIR = PAKET. Kimlik `packageNumber` (yoksa `id`): Hepsiburada'da paket ile
 * sipariş çoktan çoğadır (bir paket birkaç siparişi taşıyabilir, bir sipariş
 * bölünebilir); depo paketi okutur, barkod pakettedir. `siparisNo` paketteki
 * ilk sipariş numarasıdır; hepsi `_hb.siparisNumaralari`nda saklanır.
 */
import { kanonikDurum } from "../durum";
import { SAAT_DILIMI_ISARETI, dilimsizMetniCoz } from "../tarih";
import type { NormalKalem, NormalSiparis, NormalUrun } from "../tipler";

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** HB tarihleri ISO metin gelir ("2024-05-11T10:20:30" — Türkiye saati) ya da işaretli. */
export function tarihCoz(deger: unknown): Date | null {
  const s = metin(deger);
  if (!s) return null;
  if (SAAT_DILIMI_ISARETI.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // İşaretsiz metin Türkiye saatidir; süreç saat diliminden bağımsız çözülür.
  return dilimsizMetniCoz(s);
}

function kalemler(items: unknown): NormalKalem[] {
  if (!Array.isArray(items)) return [];
  return (items as Record<string, unknown>[]).map((k) => {
    const adet = Number(k.quantity ?? 1);
    return {
      barkod: metin(k.productBarcode) ?? metin(k.merchantSku) ?? metin(k.hbSku) ?? "",
      urunAdi: metin(k.productName) ?? "-",
      adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
      sku: metin(k.merchantSku),
    };
  });
}

export function paketNormalle(ham: unknown): NormalSiparis | null {
  const o = (ham ?? {}) as Record<string, unknown>;
  const siparisKimligi = metin(o.packageNumber) ?? metin(o.id);
  if (!siparisKimligi) return null;

  const items = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
  const siparisNumaralari = [...new Set(items.map((k) => metin(k.orderNumber)).filter((x): x is string => !!x))];
  const hamDurum = metin(o.status);

  return {
    platform: "hepsiburada",
    siparisKimligi,
    siparisNo: siparisNumaralari[0] ?? metin(o.orderNumber),
    kargoTakipNo: metin(o.barcode),
    kargoFirmasi: metin(o.cargoCompany),
    hamDurum,
    durum: kanonikDurum("hepsiburada", hamDurum),
    siparisTarihi: tarihCoz(o.orderDate),
    musteriAd: metin(o.recipientName) ?? metin(o.customerName) ?? "-",
    adres: {
      acik: [metin(o.shippingAddressDetail), metin(o.shippingDistrict)].filter(Boolean).join(" "),
      ilce: metin(o.shippingTown) ?? "",
      il: metin(o.shippingCity) ?? "",
      telefon: metin(o.phoneNumber) ?? "",
    },
    kalemler: kalemler(o.items),
    ham: { ...o, _hb: { siparisNumaralari } },
  };
}

export function urunEsle(ham: unknown): NormalUrun | null {
  const p = (ham ?? {}) as Record<string, unknown>;
  const barkod = metin(p.barcode) ?? metin(p.merchantSku);
  if (!barkod) return null;
  const gorseller = Array.isArray(p.images) ? (p.images as unknown[]) : [];
  const ilk = gorseller[0];
  return {
    barkod,
    urunAdi: metin(p.productName),
    gorselUrl: typeof ilk === "string" ? metin(ilk) : metin((ilk as Record<string, unknown> | undefined)?.url),
    marka: metin(p.brand),
    kategori: metin(p.categoryName),
    stokKodu: metin(p.merchantSku),
  };
}
