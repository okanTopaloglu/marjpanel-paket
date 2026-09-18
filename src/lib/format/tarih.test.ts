import { describe, it, expect } from "vitest";
import { gunAnahtari, gunAnahtariKaydir, gunAnahtariMi, saat, tarihSaat, goreliZaman } from "./tarih";

describe("tarih", () => {
  it("İstanbul gününü verir (UTC 22:30 → ertesi gün)", () => {
    expect(gunAnahtari(new Date("2026-03-01T22:30:00Z"))).toBe("2026-03-02");
    expect(gunAnahtari(new Date("2026-03-01T20:59:00Z"))).toBe("2026-03-01");
  });
  it("saat İstanbul'a göre", () => {
    expect(saat(new Date("2026-03-01T22:30:00Z"))).toBe("01:30");
    expect(tarihSaat(new Date("2026-03-01T22:30:00Z"))).toContain("01:30");
  });
  it("gün kaydırma ve doğrulama", () => {
    expect(gunAnahtariKaydir("2026-03-01", -1)).toBe("2026-02-28");
    expect(gunAnahtariMi("2026-02-30")).toBe(true); // Date.parse taşmayı kabul eder; biçim kontrolü yeterli
    expect(gunAnahtariMi("2026-2-3")).toBe(false);
  });
  it("geçersiz girdi tire", () => {
    expect(saat("abc")).toBe("-");
    expect(saat(null)).toBe("-");
  });
  it("göreli zaman", () => {
    const s = new Date("2026-03-01T12:00:00Z");
    expect(goreliZaman(new Date("2026-03-01T11:59:50Z"), s)).toBe("az önce");
    expect(goreliZaman(new Date("2026-03-01T11:55:00Z"), s)).toBe("5 dk önce");
    expect(goreliZaman(new Date("2026-03-01T10:00:00Z"), s)).toBe("2 sa önce");
  });
});
