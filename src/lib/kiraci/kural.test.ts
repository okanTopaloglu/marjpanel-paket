import { describe, it, expect } from "vitest";
import { alanAdiNormalize, girisKarari, hostNormalize, platformHostuMu } from "./kural";

const P = "paket.marjpanel.com";

describe("girisKarari", () => {
  it("süper yönetici her adresten girer", () => {
    expect(girisKarari({ hostPlatformMu: false, host: "x.marjpanel.com", rol: "super_admin", sirketAlanAdi: "y.marjpanel.com", platformHostu: P })).toEqual({ izin: true });
  });

  it("alan adı olmayan şirket yalnız platformdan", () => {
    expect(girisKarari({ hostPlatformMu: true, host: P, rol: "admin", sirketAlanAdi: null, platformHostu: P })).toEqual({ izin: true });
    expect(girisKarari({ hostPlatformMu: false, host: "mamaaura.marjpanel.com", rol: "calisan", sirketAlanAdi: null, platformHostu: P })).toEqual({ izin: false, dogruAdres: `https://${P}` });
  });

  it("alan adı olan şirket yalnız kendi adresinden; platformda da reddedilir", () => {
    const s = "mamaaura.marjpanel.com";
    expect(girisKarari({ hostPlatformMu: false, host: s, rol: "admin", sirketAlanAdi: s, platformHostu: P })).toEqual({ izin: true });
    expect(girisKarari({ hostPlatformMu: true, host: P, rol: "admin", sirketAlanAdi: s, platformHostu: P })).toEqual({ izin: false, dogruAdres: `https://${s}` });
    expect(girisKarari({ hostPlatformMu: false, host: "baska.marjpanel.com", rol: "calisan", sirketAlanAdi: s, platformHostu: P })).toEqual({ izin: false, dogruAdres: `https://${s}` });
  });
});

describe("hostNormalize / alanAdiNormalize / platformHostuMu", () => {
  it("host: küçük harf, port ve sondaki nokta atılır", () => {
    expect(hostNormalize("MamaAura.MarjPanel.com:3000")).toBe("mamaaura.marjpanel.com");
    expect(hostNormalize("a.com, b.com")).toBe("a.com");
    expect(hostNormalize(null)).toBe("");
  });

  it("alan adı: protokol/yol temizlenir, geçersiz reddedilir", () => {
    expect(alanAdiNormalize(" https://MamaAura.marjpanel.com/giris ")).toBe("mamaaura.marjpanel.com");
    expect(alanAdiNormalize("mamaaura")).toBeNull();
    expect(alanAdiNormalize("a b.com")).toBeNull();
    expect(alanAdiNormalize("")).toBeNull();
  });

  it("platform host: eşleşme, localhost, IP, noktasız", () => {
    expect(platformHostuMu(P, P)).toBe(true);
    expect(platformHostuMu("localhost", P)).toBe(true);
    expect(platformHostuMu("192.168.1.5", P)).toBe(true);
    expect(platformHostuMu("mamaaura.marjpanel.com", P)).toBe(false);
    expect(platformHostuMu("", P)).toBe(true);
  });
});
