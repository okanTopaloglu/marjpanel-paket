import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DENEME_SINIRI,
  KAYIT_PENCERE_MS,
  KAYIT_SINIRI,
  PENCERE_MS,
  _sifirla,
  girisDenemesiSay,
  girisSayaciTemizle,
  istemciIp,
  kayitDenemesiSay,
} from "../hiz-siniri";

describe("giriş hız sınırı", () => {
  beforeEach(() => _sifirla());

  it("sınır altındaki denemeler engellenmez", () => {
    for (let i = 0; i < DENEME_SINIRI; i++) {
      expect(girisDenemesiSay("1.2.3.4").engellendi).toBe(false);
    }
  });

  it("sınır aşılınca engeller", () => {
    for (let i = 0; i < DENEME_SINIRI; i++) girisDenemesiSay("1.2.3.4");
    expect(girisDenemesiSay("1.2.3.4").engellendi).toBe(true);
  });

  it("farklı IP'ler birbirini etkilemez", () => {
    for (let i = 0; i <= DENEME_SINIRI; i++) girisDenemesiSay("1.1.1.1");
    expect(girisDenemesiSay("2.2.2.2").engellendi).toBe(false);
  });

  it("başarılı giriş sayacı temizler — sonraki giriş bekletilmez", () => {
    for (let i = 0; i <= DENEME_SINIRI; i++) girisDenemesiSay("3.3.3.3");
    girisSayaciTemizle("3.3.3.3");
    expect(girisDenemesiSay("3.3.3.3").engellendi).toBe(false);
  });

  /** Sabit pencere: süre dolunca sayaç sıfırdan başlar, kilit sonsuz değildir. */
  it("pencere dolunca sayaç sıfırlanır", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i <= DENEME_SINIRI; i++) girisDenemesiSay("4.4.4.4");
      expect(girisDenemesiSay("4.4.4.4").engellendi).toBe(true);
      vi.advanceTimersByTime(PENCERE_MS + 1000);
      expect(girisDenemesiSay("4.4.4.4").engellendi).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("giriş ve kayıt sayaçları TAMAMEN ayrı anahtar ailesindedir", () => {
    for (let i = 0; i <= DENEME_SINIRI; i++) girisDenemesiSay("5.5.5.5");
    expect(kayitDenemesiSay("5.5.5.5").engellendi).toBe(false);
  });
});

describe("kayıt hız sınırı", () => {
  beforeEach(() => _sifirla());
  afterEach(() => vi.useRealTimers());

  it("sınır aşılınca engeller, pencere dolunca serbest bırakır", () => {
    vi.useFakeTimers();
    for (let i = 0; i < KAYIT_SINIRI; i++) {
      expect(kayitDenemesiSay("9.9.9.9").engellendi).toBe(false);
    }
    expect(kayitDenemesiSay("9.9.9.9").engellendi).toBe(true);
    vi.advanceTimersByTime(KAYIT_PENCERE_MS + 1000);
    expect(kayitDenemesiSay("9.9.9.9").engellendi).toBe(false);
  });
});

describe("istemci IP tespiti", () => {
  it("x-forwarded-for zincirinden İLK adresi alır", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(istemciIp(h)).toBe("203.0.113.9");
  });

  it("x-forwarded-for yoksa x-real-ip'e düşer", () => {
    expect(istemciIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("hiçbiri yoksa sabit bir kovaya düşer (çökmez)", () => {
    expect(istemciIp(new Headers())).toBe("bilinmeyen");
  });
});

describe("girisDenemesiSay IP+telefon", () => {
  it("aynı IP'den farklı telefon engellenmez, aynı telefon engellenir", () => {
    _sifirla();
    for (let i = 0; i <= DENEME_SINIRI; i++) girisDenemesiSay("9.9.9.9", "5551111111");
    expect(girisDenemesiSay("9.9.9.9", "5551111111").engellendi).toBe(true);
    expect(girisDenemesiSay("9.9.9.9", "5552222222").engellendi).toBe(false);
  });
});
