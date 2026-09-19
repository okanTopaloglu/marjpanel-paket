import { PLATFORMLAR, type Platform, type Yetenekler } from "./tipler";

/**
 * PAZARYERİ KAYIT DEFTERİ — İSTEMCİYE İNEBİLİR (Node modülü, sır, DB yok).
 *
 * Her pazaryerinin arayüzde ve kayıtta bilinmesi gereken her şeyi TEK YERDE
 * tutar: adı, rozet rengi, kimlik alanları (form buradan üretilir), hangi
 * alanın "hesap kimliği" olduğu (`entegrasyonlar.satici_id`ye kopyalanır,
 * tekillik anahtarıdır), yetenekleri ve barkod kurallarındaki kaynak
 * etiketleri.
 *
 * `hazir: false` olan pazaryeri arayüzde "Yakında" olarak görünür; sağlayıcı
 * kodu (`saglayici.ts`) gelmeden entegrasyon eklenemez. Böylece yol haritası
 * kullanıcıya görünür ama yarım bir bağlantı kaydedilemez.
 *
 * Alan tanımları ve API gerçekleri doğrulanmalı olanlar için `docs/pazaryeri/`
 * altında ayrıca belgelenir; buradaki metinler kullanıcıya yöneliktir.
 */

export interface AlanTanimi {
  /** Form alan adı ve kimlik JSON anahtarı. */
  ad: string;
  etiket: string;
  /** `gizli` → password alanı, listede maskeli; düzenlemede boş = eskisi korunur. */
  tip: "metin" | "gizli";
  zorunlu: boolean;
  ipucu?: string;
  ornek?: string;
  /** Doğrulama deseni (kaynak metni, RegExp'e çevrilir). */
  desen?: string;
  desenMesaji?: string;
  /** Rakam klavyesi ve tabular yazı. */
  sayisal?: boolean;
}

export interface PazaryeriTanimi {
  anahtar: Platform;
  ad: string;
  /** DESIGN.md "Pazaryeri kimlikleri" rengi; rozet çerçeve+metin, dolgu yok. */
  renk: string;
  /** `alanlar` içinden hesabı ayırt eden alan (satici_id'ye kopyalanır). */
  hesapKimligiAlani: string;
  alanlar: AlanTanimi[];
  yetenekler: Yetenekler;
  /** Barkod kurallarında bu platforma sayılan `kaynak` etiketleri. */
  kaynakEtiketleri: string[];
  /** "Anahtarları nereden alırım" — kart ipucu. */
  anahtarNereden: string;
  /** Sağlayıcı kodu hazır mı. */
  hazir: boolean;
}

const TRENDYOL: PazaryeriTanimi = {
  anahtar: "trendyol",
  ad: "Trendyol",
  renk: "#E85D2A",
  hesapKimligiAlani: "saticiId",
  alanlar: [
    {
      ad: "saticiId",
      etiket: "Satıcı ID",
      tip: "metin",
      zorunlu: true,
      ipucu: "Trendyol satıcı panelindeki mağaza numarası.",
      ornek: "123456",
      desen: "^\\d+$",
      desenMesaji: "Satıcı ID yalnız rakamlardan oluşur.",
      sayisal: true,
    },
    { ad: "apiKey", etiket: "API anahtarı", tip: "gizli", zorunlu: true },
    { ad: "apiSecret", etiket: "Gizli anahtar", tip: "gizli", zorunlu: true },
  ],
  yetenekler: {
    urun: true,
    etiket: false,
    azamiPencereGun: 14,
    sayfaArasiMs: 400,
    ilkSenkronGun: 30,
  },
  kaynakEtiketleri: ["Trendyol"],
  anahtarNereden: "Satıcı Paneli → Hesap Bilgilerim → Entegrasyon Bilgileri.",
  hazir: true,
};

const HEPSIBURADA: PazaryeriTanimi = {
  anahtar: "hepsiburada",
  ad: "Hepsiburada",
  renk: "#E0862F",
  hesapKimligiAlani: "merchantId",
  alanlar: [
    {
      ad: "merchantId",
      etiket: "Merchant ID",
      tip: "metin",
      zorunlu: true,
      ipucu: "Satıcı panelindeki mağaza kimliği (UUID). API kullanıcı adı olarak da bu kullanılır.",
      ornek: "b2910839-83b9-4d45-adb6-86bad457edcb",
      desen: "^[0-9a-fA-F-]{32,36}$",
      desenMesaji: "Merchant ID bir UUID olmalı.",
    },
    { ad: "serviceKey", etiket: "Servis anahtarı", tip: "gizli", zorunlu: true },
    {
      ad: "entegratorAdi",
      etiket: "Entegratör adı",
      tip: "metin",
      zorunlu: true,
      ipucu:
        "Hepsiburada'ya bildirdiğiniz entegratör adı, BİREBİR (User-Agent olarak gider; farklı yazılırsa 401).",
      ornek: "MamaAuraPaket",
    },
  ],
  yetenekler: {
    urun: true,
    // Ortak barkod ucu (labels) var ama yanıt biçimi doğrulanmadı; v1 dışı.
    etiket: false,
    // /packages sayfası 10 kayıt: 3 günlük pencere × 100 sayfa = 1000 paket.
    azamiPencereGun: 3,
    sayfaArasiMs: 300,
    ilkSenkronGun: 30,
  },
  kaynakEtiketleri: ["Hepsiburada", "HepsiJet", "Hepsijet"],
  anahtarNereden:
    "Satıcı Paneli → Entegrasyon → API bilgileri. Yalnız PAKETLENMİŞ siparişler çekilir (paketleme HB panelinde ya da otomatik).",
  hazir: true,
};

const N11: PazaryeriTanimi = {
  anahtar: "n11",
  ad: "N11",
  renk: "#7B3FA0",
  hesapKimligiAlani: "appKey",
  alanlar: [
    {
      ad: "appKey",
      etiket: "App Key",
      tip: "metin",
      zorunlu: true,
      ipucu: "n11 Mağaza Yönetimi → Hesabım → API Erişimi sayfasındaki anahtar.",
    },
    { ad: "appSecret", etiket: "App Secret", tip: "gizli", zorunlu: true },
  ],
  yetenekler: {
    urun: true,
    etiket: false,
    // Belgede azami aralık yok; Trendyol gibi 14 gün güvenli taraf.
    azamiPencereGun: 14,
    // Dakikada 1000 istek sınırı geniş; 200 ms nezaket payı.
    sayfaArasiMs: 200,
    ilkSenkronGun: 30,
  },
  kaynakEtiketleri: ["N11", "n11"],
  anahtarNereden: "n11 Mağaza Yönetimi → Hesabım → API Erişimi.",
  hazir: true,
};

const PAZARAMA: PazaryeriTanimi = {
  anahtar: "pazarama",
  ad: "Pazarama",
  renk: "#1E6FD9",
  hesapKimligiAlani: "clientId",
  alanlar: [
    {
      ad: "clientId",
      etiket: "API Key (Client ID)",
      tip: "metin",
      zorunlu: true,
      ipucu: "İş Ortağım paneli → Hesap Bilgileri → Entegrasyon Bilgileri.",
    },
    { ad: "clientSecret", etiket: "API Secret", tip: "gizli", zorunlu: true },
  ],
  yetenekler: {
    urun: true,
    etiket: false,
    azamiPencereGun: 14,
    // ~60 istek/dk sınırı (doğrulanmalı); 1 sn nezaket payı.
    sayfaArasiMs: 1000,
    ilkSenkronGun: 30,
  },
  kaynakEtiketleri: ["Pazarama"],
  anahtarNereden:
    "İş Ortağım Paneli → Hesap Bilgileri → Entegrasyon Bilgileri. Sipariş durum kodları kısmen doğrulandı; ilk senkron sonrası kontrol edin.",
  hazir: true,
};

const IDEFIX: PazaryeriTanimi = {
  anahtar: "idefix",
  ad: "idefix",
  // Turuncu/amber/mor/mavi/kırmızı/siyah dolu; turkuaz nane vurgusuyla
  // karışmaz. Gerçek marka rengi doğrulanmalı.
  renk: "#0E8C9B",
  hesapKimligiAlani: "vendorId",
  alanlar: [
    {
      ad: "vendorId",
      etiket: "Vendor ID",
      tip: "metin",
      zorunlu: true,
      sayisal: true,
      ipucu: "Satıcı paneli → Hesap Ayarları → Entegrasyon Bilgileri.",
    },
    { ad: "apiKey", etiket: "API Key", tip: "gizli", zorunlu: true },
    { ad: "apiSecret", etiket: "API Secret Key", tip: "gizli", zorunlu: true },
  ],
  yetenekler: {
    urun: true,
    etiket: false,
    azamiPencereGun: 14,
    sayfaArasiMs: 300,
    ilkSenkronGun: 30,
  },
  kaynakEtiketleri: ["İdefix", "Idefix", "idefix"],
  anahtarNereden:
    "Satıcı Paneli → Hesap Ayarları → Entegrasyon Bilgileri → \"Yeni API oluştur\" (anahtarlar e-postayla gelir).",
  hazir: true,
};

const AMAZON: PazaryeriTanimi = {
  anahtar: "amazon",
  ad: "Amazon",
  renk: "#1A1A1A",
  hesapKimligiAlani: "sellerId",
  alanlar: [
    {
      ad: "sellerId",
      etiket: "Seller ID",
      tip: "metin",
      zorunlu: true,
      ipucu: "Seller Central → Hesap Bilgileri → Merchant Token.",
    },
    {
      ad: "refreshToken",
      etiket: "LWA Refresh Token",
      tip: "gizli",
      zorunlu: true,
      ipucu: "Uygulama yetkilendirmesinden gelen satıcıya özel jeton.",
    },
  ],
  yetenekler: {
    urun: false,
    etiket: false,
    azamiPencereGun: null,
    sayfaArasiMs: 60_000,
    ilkSenkronGun: 7,
  },
  kaynakEtiketleri: ["Amazon", "Amazon FBA", "Amazon MFN"],
  anahtarNereden: "Seller Central → Uygulamalar ve Hizmetler → Uygulamayı yetkilendir.",
  hazir: false,
};

export const PAZARYERLERI: Record<Platform, PazaryeriTanimi> = {
  trendyol: TRENDYOL,
  hepsiburada: HEPSIBURADA,
  n11: N11,
  pazarama: PAZARAMA,
  idefix: IDEFIX,
  amazon: AMAZON,
};

/** Arayüz sırası: hazır olanlar önce, sonra yol haritası. */
export const PAZARYERI_SIRASI: Platform[] = [...PLATFORMLAR].sort(
  (a, b) => Number(PAZARYERLERI[b].hazir) - Number(PAZARYERLERI[a].hazir),
);

export function platformMi(deger: unknown): deger is Platform {
  return typeof deger === "string" && (PLATFORMLAR as readonly string[]).includes(deger);
}

/** Görünen ad; tanınmayan anahtar olduğu gibi döner (eski kayıt bozulmasın). */
export function pazaryeriAdi(platform: string): string {
  return platformMi(platform) ? PAZARYERLERI[platform].ad : platform;
}

export function pazaryeriRengi(platform: string): string | null {
  return platformMi(platform) ? PAZARYERLERI[platform].renk : null;
}

/**
 * Barkod kuralı `kaynak` metninden platform anahtarı. "Trendyol Express",
 * "Amazon FBA" gibi türevler de sayılır (önek eşleşmesi, büyük/küçük harf
 * duyarsız). Eşleşmezse null: "e-Ticaret", "Novadan" gibi pazaryeri olmayan
 * kaynaklar için doğru cevap "yok"tur.
 */
export function kaynaktanPlatform(kaynak: string | null | undefined): Platform | null {
  const k = (kaynak ?? "").trim().toLocaleLowerCase("tr");
  if (!k) return null;
  for (const p of PLATFORMLAR) {
    for (const etiket of PAZARYERLERI[p].kaynakEtiketleri) {
      if (k.startsWith(etiket.toLocaleLowerCase("tr"))) return p;
    }
  }
  return null;
}
