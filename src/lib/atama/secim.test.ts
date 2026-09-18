import { describe, it, expect } from "vitest";
import { gruplariSec, toplamaListesi } from "./secim";

describe("gruplariSec", () => {
  it("boş → boş", () => expect(gruplariSec([])).toEqual([]));
  it("en büyük grup ≥10 ise yalnız o", () => {
    expect(gruplariSec([{ imza: "a", adet: 3 }, { imza: "b", adet: 12 }])).toEqual(["b"]);
  });
  it("aksi halde 20'ye ulaşana dek ekler", () => {
    const g = [
      { imza: "a", adet: 9 },
      { imza: "b", adet: 8 },
      { imza: "c", adet: 5 },
      { imza: "d", adet: 1 },
    ];
    expect(gruplariSec(g)).toEqual(["a", "b", "c"]);
  });
  it("20'ye ulaşamazsa hepsini alır", () => {
    expect(gruplariSec([{ imza: "a", adet: 2 }, { imza: "b", adet: 1 }])).toEqual(["a", "b"]);
  });
});

describe("toplamaListesi", () => {
  it("barkod bazında toplar ve adede göre sıralar", () => {
    const l = toplamaListesi([
      { kalemler: [{ barkod: "X", urunAdi: "x", adet: 1 }, { barkod: "Y", urunAdi: "y", adet: 5 }] },
      { kalemler: [{ barkod: "X", urunAdi: "x", adet: 2 }, { barkod: "", urunAdi: "-", adet: 1 }] },
    ]);
    expect(l).toEqual([
      { barkod: "Y", urunAdi: "y", gorselUrl: null, toplamAdet: 5, siparisSayisi: 1 },
      { barkod: "X", urunAdi: "x", gorselUrl: null, toplamAdet: 3, siparisSayisi: 2 },
    ]);
  });
});
