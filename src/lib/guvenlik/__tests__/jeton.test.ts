import { describe, expect, it } from "vitest";
import { jetonEsitMi } from "../jeton";

describe("jetonEsitMi", () => {
  it("aynı jeton eşittir", () => {
    expect(jetonEsitMi("gizli-jeton-123", "gizli-jeton-123")).toBe(true);
  });

  it("farklı jeton eşit değildir", () => {
    expect(jetonEsitMi("gizli-jeton-123", "gizli-jeton-124")).toBe(false);
  });

  /** Uzunluk farkı `timingSafeEqual`i PATLATMAMALI: sha256 ile sabitlenir. */
  it("farklı uzunlukta jetonlar hata fırlatmadan false döner", () => {
    expect(jetonEsitMi("kisa", "cok-daha-uzun-bir-jeton")).toBe(false);
  });

  it("boş / tanımsız değer HER ZAMAN false döner", () => {
    expect(jetonEsitMi(null, "x")).toBe(false);
    expect(jetonEsitMi("x", null)).toBe(false);
    expect(jetonEsitMi(undefined, undefined)).toBe(false);
    expect(jetonEsitMi("", "")).toBe(false);
  });

  it("ön ek eşleşmesi yeterli değildir", () => {
    expect(jetonEsitMi("abcdef", "abc")).toBe(false);
  });
});
