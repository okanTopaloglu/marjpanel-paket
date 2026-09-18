/**
 * OKUTMA SONUCU - sunucu ile ekran arasındaki tek sözleşme.
 *
 * Repo (`db/repos/paketler`) bu birleşimi üretir, server action olduğu gibi
 * geçirir, ekran `sonuc` alanına bakarak dallanır. Tipler burada durur çünkü
 * istemci bileşenleri bunları içe aktarır; repo dosyasını içe aktarsalardı
 * veritabanı istemcisi istemci paketine sızardı.
 *
 * Buradaki her şey SAF: veritabanına, isteğe, tarayıcıya dokunmaz.
 */

/** Barkod alanının kabul ettiği en uzun değer (kargo barkodları çok daha kısa). */
export const AZAMI_BARKOD_UZUNLUGU = 64;

export interface OkutmaKalemi {
  barkod: string;
  urunAdi: string;
  adet: number;
  gorselUrl: string | null;
}

/** Barkod daha önce okutulmuşsa: kim, ne zaman. */
export interface MukerrerBilgisi {
  okutanAd: string;
  /** ISO 8601; ekran `lib/format/tarih` ile biçimlendirir. */
  okutmaZamani: string;
  ayniKullanici: boolean;
  profilGorsel: string | null;
}

/** Okutmayı engelleyen siparişin ekrana inen asgari alt kümesi. */
export interface SiparisOzeti {
  siparisNo: string | null;
  platform: string;
  entegrasyonAdi: string | null;
}

/**
 * Kayıt yapıldı ama kullanıcının bilmesi gereken bir şey var:
 *  - `bilinmeyen_kargo`: önek hiçbir kurala uymadı, kaynak/kargo boş kaldı.
 *  - `siparis_yok`: Trendyol barkodu ama eşleşen sipariş yok (senkron gecikmiş
 *    olabilir). Akış DURMAZ - paket yine kaydedilir.
 */
export type OkutmaUyarisi = "bilinmeyen_kargo" | "siparis_yok";

export type OkutmaSonucu =
  | {
      sonuc: "kaydedildi";
      barkod: string;
      kaynak: string;
      kargoFirmasi: string;
      uyari?: OkutmaUyarisi;
      /** Rehberli modun göstereceği sipariş içeriği; sipariş yoksa null. */
      rehberli: { siparisNo: string | null; kalemler: OkutmaKalemi[] } | null;
    }
  | { sonuc: "mukerrer"; barkod: string; mevcut: MukerrerBilgisi }
  | { sonuc: "iptal"; barkod: string; siparis: SiparisOzeti }
  | { sonuc: "kargolanmis"; barkod: string; siparis: SiparisOzeti };

/** Server action dönüşü: yetkisiz/geçersiz durumlar da seri hâle gelir. */
export type OkutmaCevabi =
  | { ok: true; sonuc: OkutmaSonucu }
  | { ok: false; hata: string };

export type BarkodDogrulamasi =
  | { ok: true; barkod: string }
  | { ok: false; hata: string };

/**
 * Barkod doğrulama - okutma akışının TEK giriş kapısı.
 * El terminali bazen satır sonu, sekme ya da görünmez karakter ekler; kırpma
 * burada yapılır ki hem action hem ekran aynı değeri görsün.
 */
export function barkodDogrula(ham: string): BarkodDogrulamasi {
  const barkod = (ham ?? "").trim();
  if (barkod.length === 0) return { ok: false, hata: "Barkod boş olamaz." };
  if (barkod.length > AZAMI_BARKOD_UZUNLUGU) {
    return {
      ok: false,
      hata: `Barkod en fazla ${AZAMI_BARKOD_UZUNLUGU} karakter olabilir.`,
    };
  }
  return { ok: true, barkod };
}

/** Perde tonu - DESIGN.md durum renkleriyle birebir. */
export type PerdeTonu = "hata" | "uyari" | "basari";

export interface PerdeIcerigi {
  ton: PerdeTonu;
  baslik: string;
  aciklama: string;
  /** Perdenin kendiliğinden kapanma süresi (ms). */
  sureMs: number;
}

/**
 * Sonuç → tam ekran uyarı perdesinin metni. Perde YALNIZ kullanıcının
 * durmasını gerektiren sonuçlarda açılır; başarılı okutma perde açmaz
 * (akış durmaz, satır listeye düşer ve ses çalar).
 */
export function perdeIcerigi(sonuc: OkutmaSonucu): PerdeIcerigi | null {
  switch (sonuc.sonuc) {
    case "mukerrer":
      return {
        ton: "hata",
        baslik: sonuc.mevcut.ayniKullanici
          ? "Bu paketi SİZ okuttunuz"
          : `Bu paketi ${sonuc.mevcut.okutanAd} okuttu`,
        aciklama: "Paket daha önce kaydedilmiş, ikinci kez kaydedilmedi.",
        sureMs: 2500,
      };
    case "iptal":
      return {
        ton: "hata",
        baslik: "İPTAL EDİLMİŞ sipariş",
        aciklama: "Paketi iptal bölümüne verin, kargoya vermeyin.",
        sureMs: 3000,
      };
    case "kargolanmis":
      return {
        ton: "hata",
        baslik: "Bu sipariş kargoya verilmiş",
        aciklama: "Paket zaten sevk edilmiş, tekrar hazırlamayın.",
        sureMs: 3000,
      };
    case "kaydedildi":
      if (sonuc.uyari === "siparis_yok") {
        return {
          ton: "uyari",
          baslik: "Sipariş bulunamadı",
          aciklama:
            "Paket kaydedildi ancak bu barkoda ait sipariş yok. Senkron gecikmiş olabilir.",
          sureMs: 2500,
        };
      }
      return null;
  }
}

/** Kısa satır metni - son okutmalar listesindeki durum etiketi. */
export function sonucEtiketi(sonuc: OkutmaSonucu): string {
  switch (sonuc.sonuc) {
    case "mukerrer":
      return "Mükerrer";
    case "iptal":
      return "İptal";
    case "kargolanmis":
      return "Kargoda";
    case "kaydedildi":
      if (sonuc.uyari === "bilinmeyen_kargo") return "Kargo bilinmiyor";
      if (sonuc.uyari === "siparis_yok") return "Sipariş yok";
      return "Kaydedildi";
  }
}
