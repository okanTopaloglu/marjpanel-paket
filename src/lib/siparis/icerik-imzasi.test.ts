import { describe, it, expect } from "vitest";
import { icerikImzasi, kalemleriCikar, hamVeridenImza } from "./icerik-imzasi";

describe("icerikImzasi", () => {
  it("barkoda göre sıralar ve adet ekler", () => {
    expect(
      icerikImzasi([
        { barkod: "B", urunAdi: "", adet: 2 },
        { barkod: "A", urunAdi: "", adet: 1 },
      ]),
    ).toBe("A:1|B:2");
  });
  it("boş liste null", () => {
    expect(icerikImzasi([])).toBeNull();
    expect(hamVeridenImza({})).toBeNull();
  });
  it("ham veriden kalem çıkarır; productCode yedeği ve adet varsayılanı", () => {
    const k = kalemleriCikar({ lines: [{ productCode: "X", productName: "Ürün" }, { barcode: "Y", quantity: 3 }] });
    expect(k).toEqual([
      { barkod: "X", urunAdi: "Ürün", adet: 1 },
      { barkod: "Y", urunAdi: "-", adet: 3 },
    ]);
    expect(hamVeridenImza({ lines: [{ barcode: "Y", quantity: 3 }, { barcode: "X" }] })).toBe("X:1|Y:3");
  });
});
