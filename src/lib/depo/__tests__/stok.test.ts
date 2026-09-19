import { describe, it, expect } from "vitest";
import { devirHizi, kalanAdet, stokDurumu, tukenmeGun } from "../stok-hesap";
import { kalemleriAyristir, satirlariBirlestir } from "../kalem-ayristir";

describe("stok-hesap", () => {
  it("kalan, tükenme ve devir", () => {
    const s = { giren: 100, cikan: 40, son30Cikis: 30 };
    expect(kalanAdet(s)).toBe(60);
    expect(tukenmeGun(s)).toBe(60); // 1/gün → 60 gün
    expect(devirHizi(s)).toBe(0.4); // 30 / ((60 + 90)/2)
    expect(stokDurumu(s)).toBe("normal");
  });

  it("çıkış yoksa tükenme null, durum hareketsiz; stok bitti → 0", () => {
    expect(tukenmeGun({ giren: 10, cikan: 0, son30Cikis: 0 })).toBeNull();
    expect(stokDurumu({ giren: 10, cikan: 0, son30Cikis: 0 })).toBe("hareketsiz");
    expect(tukenmeGun({ giren: 10, cikan: 10, son30Cikis: 5 })).toBe(0);
    expect(devirHizi({ giren: 0, cikan: 0, son30Cikis: 0 })).toBeNull();
  });

  it("kritik: az kaldı ya da 7 günden önce biter; eksi: kabulsüz çıkış", () => {
    expect(stokDurumu({ giren: 100, cikan: 96, son30Cikis: 3 })).toBe("kritik"); // 4 adet
    expect(stokDurumu({ giren: 100, cikan: 80, son30Cikis: 90 })).toBe("kritik"); // 20 adet, 3/gün → 7 gün
    expect(stokDurumu({ giren: 10, cikan: 12, son30Cikis: 2 })).toBe("eksi");
  });
});

describe("kalemleriAyristir", () => {
  it("sekme/noktalı virgül/boşluk ayraçları, adet varsayılan 1, tekrar eden barkod toplanır", () => {
    const r = kalemleriAyristir("869123\t5\n869124;2\n869125 3\n869123 1\n869126\n");
    expect(r.kalemler).toEqual([
      { barkod: "869123", adet: 6 },
      { barkod: "869124", adet: 2 },
      { barkod: "869125", adet: 3 },
      { barkod: "869126", adet: 1 },
    ]);
    expect(r.hatalar).toEqual([]);
  });

  it("geçersiz satırlar numarasıyla raporlanır, işaretli modda eksi kabul edilir", () => {
    const r = kalemleriAyristir("869 x\nbar kod\n869 -2");
    expect(r.hatalar.map((h) => h.satir)).toEqual([1, 2, 3]);
    expect(kalemleriAyristir("869 -2", { isaretli: true }).kalemler).toEqual([{ barkod: "869", adet: -2 }]);
    expect(kalemleriAyristir("869 0", { isaretli: true }).hatalar).toHaveLength(1);
  });

  it("form satırları aynı kurallardan geçer; boş satır atlanır", () => {
    const r = satirlariBirlestir([{ barkod: "A", adet: "2" }, { barkod: "", adet: "" }, { barkod: "A", adet: 3 }]);
    expect(r.kalemler).toEqual([{ barkod: "A", adet: 5 }]);
  });
});
