import { describe, it, expect } from "vitest";
import {
  donemAraligi,
  donemMi,
  ekHizmetleriDuzenle,
  kademeleriDuzenle,
  kesimHesapla,
  kurusMetni,
  oncekiDonem,
  paketKalemleri,
} from "../hesap";

const KADEMELER = [
  { ustSinir: null, birimFiyat: 10 },
  { ustSinir: 500, birimFiyat: 15 },
  { ustSinir: 2000, birimFiyat: 12 },
];

describe("kademeler", () => {
  it("sıralanır, sınırsız sona; bozuk satır atılır", () => {
    expect(kademeleriDuzenle(KADEMELER).map((k) => k.ustSinir)).toEqual([500, 2000, null]);
    expect(kademeleriDuzenle([{ ustSinir: -1, birimFiyat: 5 }, { ustSinir: "", birimFiyat: "7,5" }, { ustSinir: 10, birimFiyat: 3 }])).toEqual([
      { ustSinir: 10, birimFiyat: 3 },
    ]);
  });

  it("toplam tipi: adedin düştüğü kademe tüm paketlere", () => {
    expect(paketKalemleri(300, "toplam", KADEMELER)).toEqual([
      { tur: "paket", aciklama: "Paket hazırlama", adet: 300, birimFiyatKurus: 1500, tutarKurus: 450000 },
    ]);
    expect(paketKalemleri(500, "toplam", KADEMELER)[0]!.birimFiyatKurus).toBe(1500);
    expect(paketKalemleri(501, "toplam", KADEMELER)[0]!.birimFiyatKurus).toBe(1200);
    expect(paketKalemleri(9000, "toplam", KADEMELER)[0]!.birimFiyatKurus).toBe(1000);
  });

  it("dilimli tipi: her dilim kendi fiyatıyla", () => {
    const k = paketKalemleri(2500, "dilimli", KADEMELER);
    expect(k.map((x) => [x.adet, x.birimFiyatKurus])).toEqual([
      [500, 1500],
      [1500, 1200],
      [500, 1000],
    ]);
    expect(k.reduce((t, x) => t + x.tutarKurus, 0)).toBe(500 * 1500 + 1500 * 1200 + 500 * 1000);
    expect(paketKalemleri(120, "dilimli", KADEMELER)).toHaveLength(1);
  });

  it("kademe yoksa ya da paket yoksa sıfır kalem", () => {
    expect(paketKalemleri(100, "toplam", [])[0]!.tutarKurus).toBe(0);
    expect(paketKalemleri(0, "dilimli", KADEMELER)[0]!.adet).toBe(0);
  });
});

describe("kesimHesapla", () => {
  const tarife = {
    kademeTipi: "toplam" as const,
    kademeler: KADEMELER,
    ekHizmetler: [
      { kod: "patpat", ad: "Patpat sarma", birimFiyat: 2.5 },
      { kod: "koli", ad: "Koli", birimFiyat: 8 },
    ],
    kdvOrani: 20,
  };

  it("paket + ek hizmet + diğer, KDV yuvarlaması kuruşta", () => {
    const s = kesimHesapla(300, tarife, { patpat: 100, koli: 0, bilinmeyen: 5 }, [{ aciklama: "Kargo iadesi", adet: 2, birimFiyat: 33.33 }]);
    expect(s.kalemler.map((k) => k.aciklama)).toEqual(["Paket hazırlama", "Patpat sarma", "Kargo iadesi"]);
    expect(s.araToplamKurus).toBe(450000 + 25000 + 6666);
    expect(s.kdvKurus).toBe(Math.round((481666 * 20) / 100));
    expect(s.genelToplamKurus).toBe(s.araToplamKurus + s.kdvKurus);
    expect(kurusMetni(s.genelToplamKurus)).toBe("5779.99");
  });

  it("ek hizmet kodları normalize edilir, tekrar eden atılır", () => {
    expect(ekHizmetleriDuzenle([{ kod: "Pat Pat!", ad: "P", birimFiyat: 1 }, { kod: "patpat", ad: "P2", birimFiyat: 2 }, { kod: "", ad: "x", birimFiyat: 1 }])).toEqual([
      { kod: "patpat", ad: "P", birimFiyat: 1 },
    ]);
  });
});

describe("dönem", () => {
  it("doğrulama, aralık, önceki ay", () => {
    expect(donemMi("2026-09")).toBe(true);
    expect(donemMi("2026-13")).toBe(false);
    expect(donemAraligi("2026-02")).toEqual({ baslangic: "2026-02-01", bitis: "2026-02-28" });
    expect(donemAraligi("2028-02").bitis).toBe("2028-02-29");
    expect(oncekiDonem(new Date(Date.UTC(2026, 0, 15)))).toBe("2025-12");
    expect(oncekiDonem(new Date(Date.UTC(2026, 8, 19)))).toBe("2026-08");
  });
});
