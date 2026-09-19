import { describe, it, expect } from "vitest";
import { sarfDurumu, sarfGideri, sarfStogu, sarfTukenmeGun, sayimFarki, turetilenTuketim } from "../sarf-hesap";

const S = { hareketToplami: 1000, paketBasiNorm: 0.3, normSonrasiPaket: 1200, kritikSeviye: 100, birimMaliyet: 1.5 };

describe("sarf-hesap", () => {
  it("türetilen tüketim ve stok", () => {
    expect(turetilenTuketim(S)).toBe(360);
    expect(sarfStogu(S)).toBe(640);
    expect(sarfDurumu(S)).toBe("normal");
  });

  it("sayım farkı: sayılan − hesaplanan", () => {
    expect(sayimFarki(S, 600)).toBe(-40);
    expect(sayimFarki(S, 700)).toBe(60);
  });

  it("kritik ve eksi", () => {
    expect(sarfDurumu({ ...S, hareketToplami: 450 })).toBe("kritik"); // 90
    expect(sarfDurumu({ ...S, hareketToplami: 300 })).toBe("eksi"); // -60
  });

  it("tükenme ve gider", () => {
    expect(sarfTukenmeGun(640, 900, 0.3)).toBe(72); // 9/gün → 71,1 → 72
    expect(sarfTukenmeGun(640, 0, 0.3)).toBeNull();
    expect(sarfTukenmeGun(0, 100, 1)).toBe(0);
    expect(sarfGideri(1200, 0.3, 1.5)).toBe(540);
  });
});
