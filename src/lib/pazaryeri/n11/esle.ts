/**
 * N11 ham yükü → normal sipariş/ürün. SAF fonksiyonlar.
 *
 * N11'in REST sipariş ucu Trendyol'un alan adlarını kullanır (`id`,
 * `orderNumber`, `shipmentPackageStatus`, `cargoTrackingNumber`,
 * `cargoProviderName`, `shippingAddress`, `lines[]`). Eşleme Trendyol'unkini
 * çağırır, yalnız platform ve kanonik durum N11'e çevrilir; iki kopya
 * tutmak, biri düzeltilince diğerinin geride kalması demekti.
 *
 * Ürün ucu (`/ms/product-query`) farklıdır: `stockCode`, `title`, `barcode`,
 * `imageUrls[]`; marka adı yanıtta yok.
 */
import { kanonikDurum } from "../durum";
import type { NormalSiparis, NormalUrun } from "../tipler";
import { siparisNormalle as trendyolNormalle } from "../trendyol/esle";

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function siparisNormalle(ham: unknown): NormalSiparis | null {
  // N11 tarihleri epoch ms verir; metin tarih gelirse GMT+3 kabul edilir.
  const n = trendyolNormalle(ham, { saatOfseti: 3 });
  if (!n) return null;
  const o = (ham ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(o.lines) ? (o.lines as Record<string, unknown>[]) : [];
  return {
    ...n,
    platform: "n11",
    durum: kanonikDurum("n11", n.hamDurum),
    // N11'de barkodsuz kalemde stok kodu satıcının SKU'sudur; ürün tablosu
    // Excel'den o kodla dolmuş olabilir.
    kalemler: n.kalemler.map((k, i) => ({
      ...k,
      barkod: k.barkod || metin(lines[i]?.stockCode) || "",
      sku: metin(lines[i]?.stockCode),
    })),
  };
}

export function urunEsle(ham: unknown): NormalUrun | null {
  const p = (ham ?? {}) as Record<string, unknown>;
  const barkod = metin(p.barcode) ?? metin(p.stockCode);
  if (!barkod) return null;
  const gorseller = Array.isArray(p.imageUrls) ? (p.imageUrls as unknown[]) : [];
  const ilkGorsel = gorseller[0];
  return {
    barkod,
    urunAdi: metin(p.title),
    gorselUrl:
      typeof ilkGorsel === "string"
        ? metin(ilkGorsel)
        : metin((ilkGorsel as Record<string, unknown> | undefined)?.url),
    marka: metin(p.brandName) ?? metin(p.brand),
    kategori: metin(p.categoryName) ?? metin(p.categoryId),
    stokKodu: metin(p.stockCode),
  };
}
