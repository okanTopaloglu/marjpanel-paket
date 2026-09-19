/**
 * Trendyol ham yükü → normal sipariş/ürün. SAF fonksiyonlar (G/Ç yok, test edilir).
 *
 * PartnerSys `mapTrendyolOrder` / `mapTrendyolProduct` portu. İki yerde
 * bilerek AYRILIR:
 *
 *  1. KİMLİK: PartnerSys `orderNumber`'ı kimlik olarak kullanıyordu. Bir
 *     sipariş birden fazla KARGO PAKETİNE bölündüğünde (Trendyol bunu sık
 *     yapar) aynı `orderNumber` ile iki paket gelir ve ikincisi birincinin
 *     üstüne yazılırdı — paketlerden biri panelde hiç görünmezdi. Kimlik
 *     `shipmentPackageId` (paket kimliği), yoksa `id`, o da yoksa
 *     `orderNumber`.
 *  2. DURUM: `shipmentPackageStatus` varsa o kazanır; paketin durumu
 *     siparişin durumundan ayrılabilir (bir paket kargoda, diğeri hazırlanıyor).
 *
 * Müşteri adı, adres ve kalemler `lib/siparis/ham-veri`nin Trendyol
 * okuyucularıyla doldurulur (birebir eski davranış) ve normal zarfa yazılır.
 */
import {
  aliciTelefonu,
  etiketAdresi,
  musteriAdi,
  siparisKalemleri,
} from "@/lib/siparis/ham-veri";
import { kanonikDurum } from "../durum";
import { normaldenSatir, type EslenenSiparis } from "../normal-veri";
import type { NormalSiparis, NormalUrun } from "../tipler";

export interface EsleSecenekleri {
  /**
   * Saat ofseti (saat). YALNIZ saat dilimi BELİRTİLMEYEN metin tarihlerde
   * uygulanır — bkz. `tarihCoz` gövde notu.
   */
  saatOfseti?: number;
}

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Saat dilimi işareti taşıyan ISO metni ("…Z", "…+03:00") MUTLAK zamandır. */
const SAAT_DILIMI_ISARETI = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Tarih çözümü ve SAAT OFSETİ KARARI (belgelenmiş karar).
 *
 * Trendyol `orderDate` alanını EPOCH MİLİSANİYE olarak verir. Epoch mutlak bir
 * andır: içinde saat dilimi yoktur, kaydırmak veriyi BOZAR. PartnerSys de
 * hiçbir ofset uygulamıyordu ve tarihleri doğru gösteriyordu; `lib/format/tarih`
 * zaten her şeyi `Europe/Istanbul` ile biçimlendirdiği için gösterim de doğrudur.
 *
 * Bu yüzden `TRENDYOL_SIPARIS_SAAT_OFSETI` (.env: 3) YALNIZCA saat dilimi
 * BELİRTİLMEYEN metin tarihlere uygulanır ("2026-03-01T10:00:00" gibi; bazı
 * uçlar böyle döner ve bu metin Türkiye yerel saatidir). Node böyle bir metni
 * KONTEYNERİN saat dilimiyle okur (üretimde UTC); ofset saatleri çıkarılarak
 * değer gerçek ana taşınır. Epoch sayıları ve işaretli ISO metinleri ASLA
 * kaydırılmaz.
 */
export function tarihCoz(deger: unknown, saatOfseti: number): Date | null {
  if (deger === null || deger === undefined || deger === "") return null;

  if (typeof deger === "number") {
    const d = new Date(deger);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(deger).trim();
  if (!s) return null;

  // Sayı metni de epoch'tur (bazı uçlar ms'yi string olarak yollar).
  if (/^\d{10,}$/.test(s)) {
    const d = new Date(Number(s));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (SAAT_DILIMI_ISARETI.test(s) || !saatOfseti) return d;
  return new Date(d.getTime() - saatOfseti * 3_600_000);
}

/**
 * Tek bir Trendyol paketini normal siparişe çevirir. Kimlik üretilemiyorsa
 * `null` — kimliksiz satır upsert anahtarını bozar, sessizce atlanır.
 */
export function siparisNormalle(
  ham: unknown,
  { saatOfseti = 0 }: EsleSecenekleri = {},
): NormalSiparis | null {
  const o = (ham ?? {}) as Record<string, unknown>;
  const satirlar = Array.isArray(o.lines) ? (o.lines as Record<string, unknown>[]) : [];
  const ilk = satirlar[0] ?? {};

  const siparisKimligi = metin(o.shipmentPackageId) ?? metin(o.id) ?? metin(o.orderNumber);
  if (!siparisKimligi) return null;

  const hamDurum = metin(o.shipmentPackageStatus) ?? metin(o.status);
  const adres = etiketAdresi(o);
  const [ilce = "", il = ""] = adres.ilceIl.split(" - ");

  return {
    platform: "trendyol",
    siparisKimligi,
    siparisNo: metin(o.orderNumber),
    // Takip no ÖNCE satırdan: paket bazlı takip numarası satırda taşınır,
    // sipariş kökündeki alan birden çok pakette boş kalabiliyor.
    kargoTakipNo: metin(ilk.cargoTrackingNumber) ?? metin(o.cargoTrackingNumber),
    kargoFirmasi: metin(o.cargoProviderName) ?? metin(ilk.cargoProviderName),
    hamDurum,
    durum: kanonikDurum("trendyol", hamDurum),
    siparisTarihi: tarihCoz(o.orderDate ?? o.createdDate, saatOfseti),
    musteriAd: musteriAdi(o),
    adres: { acik: adres.acik, ilce, il, telefon: aliciTelefonu(o) },
    kalemler: siparisKalemleri(o).map((k) => ({
      barkod: k.barkod,
      urunAdi: k.urunAdi,
      adet: k.adet,
      sku: metin((satirlar.find((l) => metin(l.barcode) === k.barkod) ?? {}).merchantSku),
    })),
    ham: o,
  };
}

/** Geriye uyumlu kısayol: ham → veritabanı satırı (testler ve deneme betiği). */
export function siparisEsle(
  ham: unknown,
  { entegrasyonAdi, saatOfseti = 0 }: EsleSecenekleri & { entegrasyonAdi: string },
): EslenenSiparis | null {
  const n = siparisNormalle(ham, { saatOfseti });
  return n ? normaldenSatir(n, entegrasyonAdi) : null;
}

/**
 * Trendyol ürününü satıra çevirir. Barkodsuz ya da ARŞİVLENMİŞ ürün `null`
 * döner: barkod ürün tablosunun tekillik anahtarıdır, arşivlenmiş ürün ise
 * depoda artık aranmaz (eski adı/görseli taze kaydın üstüne yazmasın).
 */
export function urunEsle(ham: unknown): NormalUrun | null {
  const p = (ham ?? {}) as Record<string, unknown>;
  const barkod = metin(p.barcode);
  if (!barkod) return null;
  if (p.archived === true) return null;

  const gorseller = Array.isArray(p.images) ? (p.images as Record<string, unknown>[]) : [];

  return {
    barkod,
    urunAdi: metin(p.title),
    gorselUrl: metin(gorseller[0]?.url),
    marka: metin(p.brand),
    kategori: metin(p.categoryName),
    stokKodu: metin(p.stockCode),
  };
}
