import { describe, expect, it } from "vitest";
import { guvenlikBasliklari } from "../basliklar";

describe("güvenlik başlıkları", () => {
  it("temel sertleştirme başlıklarını her zaman verir", () => {
    const b = guvenlikBasliklari({ https: true });
    expect(b["X-Content-Type-Options"]).toBe("nosniff");
    expect(b["X-Frame-Options"]).toBe("DENY");
    expect(b["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(b["X-Permitted-Cross-Domain-Policies"]).toBe("none");
  });

  /**
   * BU TESTİN VARLIK SEBEBİ: kamera kapatılırsa paket okutma ekranı (barkod
   * tarayıcı) çalışmaz. Kopyala-yapıştır bir sertleştirme turunda `camera=()`
   * geri gelirse uygulamanın ANA İŞİ sessizce ölür.
   */
  it("KAMERAYA izin verir (barkod okutma), diğer cihaz izinleri kapalıdır", () => {
    const p = guvenlikBasliklari({ https: true })["Permissions-Policy"]!;
    expect(p).toContain("camera=(self)");
    expect(p).toContain("microphone=()");
    expect(p).toContain("geolocation=()");
  });

  it("HSTS YALNIZ https'te gönderilir (localhost kalıcı https'e kilitlenmesin)", () => {
    expect(guvenlikBasliklari({ https: true })["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(
      guvenlikBasliklari({ https: false })["Strict-Transport-Security"],
    ).toBeUndefined();
  });

  it("HSTS'e preload EKLENMEZ — tek yönlü karar sahibine bırakılır", () => {
    expect(
      guvenlikBasliklari({ https: true })["Strict-Transport-Security"],
    ).not.toContain("preload");
  });

  /**
   * CSP'nin yanlışlıkla zorunlu moda alınması paneli beyaz ekrana düşürür
   * (Next satır içi script/style üretir).
   */
  it("CSP yalnız RAPOR modunda gönderilir; zorlayıcı CSP YOKTUR", () => {
    const b = guvenlikBasliklari({ https: true });
    expect(b["Content-Security-Policy-Report-Only"]).toBeTruthy();
    expect(b["Content-Security-Policy"]).toBeUndefined();
  });

  it("rapor CSP'si uzak ürün görsellerine izin verir (Trendyol CDN)", () => {
    const csp = guvenlikBasliklari({ https: true })[
      "Content-Security-Policy-Report-Only"
    ]!;
    expect(csp).toContain("img-src 'self' https: data: blob:");
  });

  it("rapor CSP'si fatura alan adlarını iframe'e alır", () => {
    const csp = guvenlikBasliklari({ https: true })[
      "Content-Security-Policy-Report-Only"
    ]!;
    expect(csp).toContain("frame-src https://faturapaylas.partnercosmetics.com.tr");
    expect(csp).toContain("https://fatura.partnercosmetics.com.tr");
  });

  it("rapor CSP'si clickjacking, base-uri ve connect-src direktiflerini taşır", () => {
    const csp = guvenlikBasliklari({ https: true })[
      "Content-Security-Policy-Report-Only"
    ]!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  });
});
