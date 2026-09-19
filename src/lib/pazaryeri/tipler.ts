import type { SiparisDurumu } from "@/lib/siparis/sabitler";

/**
 * PAZARYERİ SAĞLAYICI SÖZLEŞMESİ — her pazaryeri bu arayüzü uygular, motor
 * (`lib/senkron/*`) yalnız bunu tanır.
 *
 * Trendyol'a özgü varsayımlar (0 tabanlı sayfa + `totalPages`, 14 günlük
 * pencere, 200'lük sayfa) buradan bilerek çıkarıldı:
 *
 *  · SAYFALAMA OPAK İMLEÇTİR (`Sayfa.sonrakiImlec`). Trendyol için sayfa
 *    numarasının metni, Amazon için `NextToken`, Hepsiburada için
 *    `offset`. Motor imlecin içine bakmaz; `null` gelene kadar ister.
 *  · PENCERE VE HIZ `Yetenekler`TEN OKUNUR. Trendyol 14 günden uzun aralığı
 *    reddeder, Amazon `LastUpdatedAfter` ile tek pencere ister; motor sabit
 *    sayı bilmez.
 *  · DURUM KANONİKTİR. Sağlayıcı ham durumunu `lib/siparis/sabitler`
 *    kümesine eşleyerek verir; SQL (sekme, havuz, 17:00 kesimi) değişmez.
 *
 * Bu dosya istemciye de inebilir (yalnız tip). Sunucu tarafı `saglayici.ts`.
 */

export const PLATFORMLAR = [
  "trendyol",
  "hepsiburada",
  "n11",
  "pazarama",
  "idefix",
  "amazon",
] as const;
export type Platform = (typeof PLATFORMLAR)[number];

export interface NormalKalem {
  barkod: string;
  urunAdi: string;
  adet: number;
  sku?: string | null;
}

export interface NormalAdres {
  /** Açık adres (mahalle/sokak/kapı). */
  acik: string;
  ilce: string;
  il: string;
  telefon: string;
}

/**
 * Normalize sipariş — motorun veritabanına yazdığı şekil.
 *
 * `siparisKimligi` KARGO PAKETİ kimliğidir (upsert anahtarı): bir sipariş
 * birden çok pakete bölündüğünde her paket ayrı satırdır.
 * `kargoTakipNo` etikette BASILAN ve depoda OKUTULAN değerdir; okutma
 * eşleşmesinin tek yolu budur (`repos/okut-siparis.takipNoIleSiparis`).
 */
export interface NormalSiparis {
  platform: Platform;
  siparisKimligi: string;
  siparisNo: string | null;
  kargoTakipNo: string | null;
  kargoFirmasi: string | null;
  /** Pazaryerinin verdiği ham durum metni (`ham_durum` sütunu). */
  hamDurum: string | null;
  /** Kanonik durum (`lib/siparis/sabitler`). */
  durum: SiparisDurumu;
  siparisTarihi: Date | null;
  musteriAd: string;
  adres: NormalAdres;
  kalemler: NormalKalem[];
  /** Pazaryeri yükünün tamamı (ham_veri). */
  ham: Record<string, unknown>;
}

export interface NormalUrun {
  barkod: string;
  urunAdi: string | null;
  gorselUrl: string | null;
  marka: string | null;
  kategori: string | null;
  stokKodu: string | null;
}

/** Sayfalı sonuç; `sonrakiImlec === null` son sayfadır. */
export interface Sayfa<T> {
  kayitlar: T[];
  sonrakiImlec: string | null;
  /** Bilgi amaçlı (ilerleme çubuğu); sağlayıcı bilmiyorsa null. */
  toplamSayfa?: number | null;
  /** 0 tabanlı; bilgi amaçlı. */
  sayfaNo?: number;
}

export interface SiparisIstegi {
  /** Epoch ms (dâhil). */
  baslangic: number;
  /** Epoch ms (dâhil). */
  bitis: number;
  /** İlk istekte null. */
  imlec: string | null;
}

export interface UrunIstegi {
  imlec: string | null;
}

export interface Yetenekler {
  /** Ürün kataloğu çekilebilir mi. */
  urun: boolean;
  /** Pazaryerinden kargo etiketi indirilebilir mi. */
  etiket: boolean;
  /** Tek istekte izin verilen azami tarih aralığı (gün); null = sınırsız. */
  azamiPencereGun: number | null;
  /** Ardışık sayfalar arasında beklenecek süre (ms). */
  sayfaArasiMs: number;
  /** İlk senkronda geriye gidilen gün sayısı. */
  ilkSenkronGun: number;
}

export interface BaglantiTestSonucu {
  ok: boolean;
  mesaj: string;
}

export type EtiketSonucu =
  | { tur: "pdf" | "zpl" | "png"; veri: Buffer; dosyaAdi: string }
  | { tur: "url"; url: string };

export interface PazaryeriSaglayici {
  readonly platform: Platform;
  readonly yetenekler: Yetenekler;
  baglantiTest(): Promise<BaglantiTestSonucu>;
  siparisler(p: SiparisIstegi): Promise<Sayfa<NormalSiparis>>;
  /** `yetenekler.urun` true ise tanımlıdır. */
  urunler?(p: UrunIstegi): Promise<Sayfa<NormalUrun>>;
  /** `yetenekler.etiket` true ise tanımlıdır. */
  etiket?(siparisKimligi: string): Promise<EtiketSonucu | null>;
}
