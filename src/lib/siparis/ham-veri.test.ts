import { describe, it, expect } from "vitest";
import {
  asgariHamVeri,
  musteriAdi,
  etiketAdresi,
  siparisKalemleri,
  aliciTelefonu,
} from "./ham-veri";

const HAM = {
  customerFirstName: "Ayse",
  customerLastName: "Yilmaz",
  shipmentAddress: {
    address1: "Ornek Mah. 1. Sk No:2",
    address2: "Daire 5",
    neighborhood: "Merkez",
    city: "Istanbul",
    district: "Kadikoy",
    phone: "05321234567",
  },
  lines: [
    { barcode: "869", productName: "Krem", quantity: 2 },
    { productCode: "STK-9", name: "Sampuan" },
  ],
  // Arayüze inmemesi gereken alanlar:
  tcIdentityNumber: "11111111111",
  totalPrice: 499.9,
};

describe("asgariHamVeri", () => {
  it("yalnız ad, adres özeti ve kalemleri taşır", () => {
    const a = asgariHamVeri(HAM);
    expect(a).toEqual({
      musteriAd: "Ayse Yilmaz",
      adresOzeti: "Kadikoy - Istanbul",
      kalemler: [
        { barkod: "869", urunAdi: "Krem", adet: 2 },
        { barkod: "STK-9", urunAdi: "Sampuan", adet: 1 },
      ],
    });
    // Hassas alanlar alt kümede YOK.
    expect(JSON.stringify(a)).not.toContain("11111111111");
    expect(JSON.stringify(a)).not.toContain("499.9");
  });

  it("boş yükte çökmez", () => {
    expect(asgariHamVeri(null)).toEqual({
      musteriAd: "-",
      adresOzeti: "",
      kalemler: [],
    });
  });
});

describe("musteriAdi", () => {
  it("ad+soyad yoksa tek alana, o da yoksa tireye düşer", () => {
    expect(musteriAdi({ customerFirstName: "A", customerLastName: "B" })).toBe("A B");
    expect(musteriAdi({ customerName: "Tek Ad" })).toBe("Tek Ad");
    expect(musteriAdi({})).toBe("-");
  });
});

describe("etiketAdresi", () => {
  it("açık adresi ve ilçe-il satırını ayırır", () => {
    expect(etiketAdresi(HAM)).toEqual({
      acik: "Ornek Mah. 1. Sk No:2 Daire 5 Merkez",
      ilceIl: "Kadikoy - Istanbul",
    });
  });

  it("adres kökteyse de bulur", () => {
    expect(etiketAdresi({ address1: "Kok adres", city: "Ankara" })).toEqual({
      acik: "Kok adres",
      ilceIl: "Ankara",
    });
  });
});

describe("siparisKalemleri", () => {
  it("adet sayı değilse 1'e düşer", () => {
    expect(siparisKalemleri({ lines: [{ barcode: "A", quantity: "abc" }] })).toEqual([
      { barkod: "A", urunAdi: "-", adet: 1 },
    ]);
  });
});

describe("aliciTelefonu", () => {
  it("adres içinden telefonu alır", () => {
    expect(aliciTelefonu(HAM)).toBe("05321234567");
    expect(aliciTelefonu({})).toBe("");
  });
});
