/**
 * GÜVENLİK BAŞLIKLARI — TEK KAYNAK.
 * ---------------------------------------------------------------------------
 * `middleware.ts` her yanıta bu başlıkları ekler. Hiçbiri uygulamanın
 * DAVRANIŞINI değiştirmez: hepsi tarayıcıya "bu sayfayı nasıl ele al" der,
 * sunucu tarafında bir kapı kapatmaz.
 *
 * CSP bilerek YALNIZ RAPOR modundadır (`Content-Security-Policy-Report-Only`).
 * Next.js App Router satır içi bootstrap script'i ve style'ı üretir; nonce
 * altyapısı kurulmadan sıkı bir CSP paneli beyaz ekrana düşürür. Rapor modu
 * hiçbir şeyi engellemez, yalnız ihlalleri konsola yazar.
 */

/**
 * Cihaz izinleri. `camera=(self)` TEK İSTİSNADIR ve ZORUNLUDUR: paket okutma
 * ekranı barkodu telefonun KAMERASIYLA okur (html5-qrcode). Kapalı olsaydı
 * uygulamanın ana işi çalışmazdı. Diğerlerinin hiçbiri kullanılmıyor.
 */
const IZIN_POLITIKASI = [
  "camera=(self)",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  // FLoC/Topics reklam sinyali — panel veri satmıyor, kapalı kalsın.
  "interest-cohort=()",
].join(", ");

/**
 * RAPOR-ONLY CSP.
 *
 * `'unsafe-inline'` / `'unsafe-eval'` BİLEREK buradadır (Next satır içi kod
 * üretir). Rapor modunda oldukları için şu an bir şeyi engellemiyorlar.
 *
 * `img-src` uzak https'e açıktır: ürün görselleri Trendyol CDN'inden gelir ve
 * panelde doğrudan gösterilir; kısıtlanırsa rapor modu sahte ihlal yağmuruna
 * döner ve sinyal kaybolur.
 *
 * `frame-src` iki fatura alan adını taşır: fatura paylaş / fatura kesim
 * ekranları bu sayfaları iframe içinde gömer.
 *
 * `frame-ancestors 'none'`: clickjacking'e karşı asıl koruma; X-Frame-Options
 * ile ikisi birden gönderilir (modern tarayıcı CSP'yi, eski XFO'yu okur).
 */
const CSP_RAPOR = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://faturapaylas.partnercosmetics.com.tr https://fatura.partnercosmetics.com.tr",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export interface GuvenlikBaslikSecenek {
  /**
   * HSTS yalnız HTTPS'te anlamlıdır ve GERİ ALINMASI ZORDUR (tarayıcı süreyi
   * hatırlar). Yerel geliştirmede gönderilmez; aksi hâlde geliştiricinin
   * tarayıcısı localhost'u kalıcı https'e zorlar.
   */
  https: boolean;
}

/** Yanıta eklenecek güvenlik başlıkları (ad → değer). */
export function guvenlikBasliklari({
  https,
}: GuvenlikBaslikSecenek): Record<string, string> {
  const b: Record<string, string> = {
    // MIME sniffing kapalı: sunucunun dediği tür neyse odur.
    "X-Content-Type-Options": "nosniff",
    // Eski tarayıcılar için clickjacking kapısı (CSP frame-ancestors'ın eşi).
    "X-Frame-Options": "DENY",
    // Dış sitelere tam URL sızmasın; kendi içimizde tam adres korunur.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": IZIN_POLITIKASI,
    // Adobe crossdomain.xml politikası — panel hiç yayınlamıyor.
    "X-Permitted-Cross-Domain-Policies": "none",
    "Content-Security-Policy-Report-Only": CSP_RAPOR,
  };

  if (https) {
    // 2 yıl + alt alan adları. `preload` BİLEREK YOK: preload listesine girmek
    // tek yönlü bir karardır, alan adının tamamını kalıcı https'e kilitler.
    b["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }

  return b;
}
