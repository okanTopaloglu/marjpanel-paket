/**
 * GİRİŞ / KAYIT HIZ SINIRI — SÜREÇ İÇİ SABİT PENCERE.
 * ---------------------------------------------------------------------------
 * Bu, hesap kilidinin (`kullanicilar.hatali_deneme` / `kilit_bitis`, bkz.
 * auth.ts) YERİNE DEĞİL ÖNÜNE konur. İkisi farklı şeyi korur:
 *
 *   · Hesap kilidi → TEK HESABI hedefleyen saldırıyı durdurur, ama saldırgan
 *                    hesap başına 5 hakkını bin hesap üzerinde kullanabilir
 *                    (parola püskürtme) ve her deneme bir argon2 doğrulaması
 *                    maliyeti çıkarır.
 *   · Bu sınır     → IP'yi pencere başına sayar; argon2 HİÇ çalışmadan
 *                    reddeder (CPU tükenmesine karşı da korur).
 *
 * NEDEN REDIS DEĞİL: MarjPanel Paket tek Next süreci olarak koşar; ayrı bir
 * worker'ı ve Redis'i YOKTUR. Sayaç süreç belleğinde tutulur. Bunun bilinen
 * iki sınırı vardır ve kabul edilmiştir:
 *   1. Yeniden dağıtımda / süreç yeniden başlarken sayaçlar sıfırlanır.
 *   2. Çok örnekli (yatay ölçekli) kurulumda her örnek kendi sayacını tutar.
 * Her iki durumda da hesap kilidi görevinin başındadır. Ölçek gerektiğinde
 * bu modülün ARKASI değiştirilir, çağıranlar aynı kalır.
 *
 * Fonksiyonlar SENKRONDUR (bellek erişimi; G/Ç yok).
 */

/**
 * Pencere başına izin verilen giriş denemesi — IP + TELEFON anahtarıyla.
 * Depo çalışanlarının hepsi tek NAT IP'sinden gelir; yalnız IP'ye sayılsaydı
 * bir kişinin hataları bütün depoyu kilitlerdi.
 */
export const DENEME_SINIRI = 10;
/** Aynı IP'den TÜM hesaplara toplam deneme tavanı (dağıtık parola denemesi). */
export const IP_TAVANI = 100;
/** Sayaç penceresi (ms) — 15 dakika. */
export const PENCERE_MS = 15 * 60 * 1000;

export const HIZ_SINIRI_MESAJI =
  "Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.";

/** Kayıt sınırı ayrı bir anahtar ailesidir: amaç sahte hesap üretimini yavaşlatmak. */
export const KAYIT_SINIRI = 5;
export const KAYIT_PENCERE_MS = 60 * 60 * 1000;

export const KAYIT_HIZ_SINIRI_MESAJI =
  "Bu bağlantıdan çok fazla kayıt denemesi yapıldı. Lütfen bir süre sonra tekrar deneyin.";

interface Sayac {
  /** Pencere içindeki deneme sayısı. */
  n: number;
  /** Pencerenin başladığı an (ms). */
  son: number;
}

/**
 * Tek sözlük, anahtar öneki ile aileler ayrılır (`giris:` / `kayit:`).
 * Geliştirmede HMR modülü yeniden yüklerse sayaç kaybolmasın diye global'e
 * tutunur — aksi hâlde her kaydetmede sınır sıfırlanırdı.
 */
const globalForHiz = globalThis as unknown as {
  hizSayaclari: Map<string, Sayac> | undefined;
};
const sayaclar: Map<string, Sayac> =
  globalForHiz.hizSayaclari ?? new Map<string, Sayac>();
globalForHiz.hizSayaclari = sayaclar;

/** Sözlük sınırsız büyümesin: her N çağrıda süresi geçmişler süpürülür. */
let cagriSayisi = 0;
const SUPURME_ARALIGI = 500;

function supur(simdi: number): void {
  for (const [k, s] of sayaclar) {
    // En uzun pencere kayıt penceresidir; ondan eski her kayıt ölüdür.
    if (simdi - s.son > KAYIT_PENCERE_MS) sayaclar.delete(k);
  }
}

function anahtar(aile: string, deger: string): string {
  return `${aile}:${deger.toLowerCase().trim().slice(0, 120)}`;
}

/**
 * Sabit pencere: pencere dolduğunda sayaç sıfırdan başlar. Kayan pencereye
 * göre kabadır ama bir kaba kuvvet yavaşlatıcısı için fazlasıyla yeterlidir
 * ve tek bir sayı tutar.
 */
function say(k: string, sinir: number, pencereMs: number): boolean {
  const simdi = Date.now();
  if (++cagriSayisi % SUPURME_ARALIGI === 0) supur(simdi);

  const mevcut = sayaclar.get(k);
  if (!mevcut || simdi - mevcut.son >= pencereMs) {
    sayaclar.set(k, { n: 1, son: simdi });
    return false;
  }
  mevcut.n += 1;
  return mevcut.n > sinir;
}

export interface HizSiniriSonuc {
  /** true → işlem denenmemeli, kullanıcıya ilgili mesaj gösterilir. */
  engellendi: boolean;
}

/**
 * Ters vekil (Coolify/Caddy/Cloudflare) arkasında gerçek istemci IP'si.
 * `x-forwarded-for` VİRGÜLLE ayrılmış zincirdir; İLK değer istemcidir.
 */
export function istemciIp(basliklar: Headers): string {
  const xff = basliklar.get("x-forwarded-for");
  const ilk = xff?.split(",")[0]?.trim();
  if (ilk) return ilk;
  return basliklar.get("x-real-ip")?.trim() || "bilinmeyen";
}

/** Giriş denemesini sayar: IP+telefon başına DENEME_SINIRI, IP başına IP_TAVANI. */
export function girisDenemesiSay(ip: string, telefon = ""): HizSiniriSonuc {
  const ipTavan = say(anahtar("giris-ip", ip), IP_TAVANI, PENCERE_MS);
  const hesap = say(anahtar("giris", `${ip}|${telefon}`), DENEME_SINIRI, PENCERE_MS);
  return { engellendi: ipTavan || hesap };
}

/**
 * Başarılı girişten sonra sayacı temizler — doğru parolayı giren kullanıcı,
 * daha önceki hatalı denemeleri yüzünden beklemek zorunda kalmasın.
 */
export function girisSayaciTemizle(ip: string, telefon = ""): void {
  sayaclar.delete(anahtar("giris", `${ip}|${telefon}`));
}

/**
 * IP başına saatlik kayıt denemesi. Başarısız denemeler de SAYILIR — yalnız
 * başarılıları saymak, saldırganın "her denemeyi kasıtlı geçersiz bilgiyle"
 * sınırı aşındırmasına izin verirdi.
 */
export function kayitDenemesiSay(ip: string): HizSiniriSonuc {
  return { engellendi: say(anahtar("kayit", ip), KAYIT_SINIRI, KAYIT_PENCERE_MS) };
}

/** Test amaçlı: tüm sayaçları sıfırlar (üretimde çağrılmaz). */
export function _sifirla(): void {
  sayaclar.clear();
  cagriSayisi = 0;
}
