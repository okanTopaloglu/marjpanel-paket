import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  basligiNormalize,
  hucreMetni,
  sutunlariEsle,
  urunOku,
} from "./urun-oku";

/** Test çalışma kitabı: satırlar olduğu gibi yazılır (başlık dâhil). */
async function kitapYap(satirlar: unknown[][]): Promise<Uint8Array> {
  const kitap = new ExcelJS.Workbook();
  const sayfa = kitap.addWorksheet("Ürünler");
  for (const satir of satirlar) sayfa.addRow(satir);
  const tampon = await kitap.xlsx.writeBuffer();
  return new Uint8Array(tampon as ArrayBuffer);
}

describe("basligiNormalize", () => {
  it("Türkçe harfleri sadeleştirir ve ayraçları düşürür", () => {
    expect(basligiNormalize("Ürün Adı")).toBe("urunadi");
    expect(basligiNormalize(" STOK_KODU ")).toBe("stokkodu");
    expect(basligiNormalize("Görsel / URL")).toBe("gorselurl");
    expect(basligiNormalize(null)).toBe("");
  });
});

describe("hucreMetni", () => {
  it("düz değerleri metne çevirir", () => {
    expect(hucreMetni("  8680  ")).toBe("8680");
    expect(hucreMetni(8680)).toBe("8680");
    expect(hucreMetni(null)).toBe("");
  });

  it("zengin metin, köprü ve formül hücrelerini çözer", () => {
    expect(hucreMetni({ richText: [{ text: "Mavi " }, { text: "Tişört" }] })).toBe(
      "Mavi Tişört",
    );
    expect(hucreMetni({ text: "", hyperlink: "https://cdn/1.jpg" })).toBe(
      "https://cdn/1.jpg",
    );
    expect(hucreMetni({ formula: "A1", result: "Sonuç" })).toBe("Sonuç");
    expect(hucreMetni({ error: "#N/A" })).toBe("");
  });
});

describe("sutunlariEsle", () => {
  it("Türkçe ve İngilizce başlıkları aynı alana bağlar", () => {
    const tr = sutunlariEsle(["Barkod", "Ürün Adı", "Görsel", "Marka", "Kategori", "Stok Kodu"]);
    expect(tr.indisler).toEqual({
      barkod: 0,
      urunAdi: 1,
      gorselUrl: 2,
      marka: 3,
      kategori: 4,
      stokKodu: 5,
    });
    expect(tr.sutunlar.urunAdi).toBe("Ürün Adı");

    const en = sutunlariEsle(["Barcode", "Product Name", "Image URL", "Brand", "Category", "SKU"]);
    expect(en.indisler.barkod).toBe(0);
    expect(en.indisler.urunAdi).toBe(1);
    expect(en.indisler.gorselUrl).toBe(2);
    expect(en.indisler.stokKodu).toBe(5);
  });

  it("bir sütunu tek alana bağlar, eşleşmeyen alan null kalır", () => {
    const e = sutunlariEsle(["Barkod", "Adet"]);
    expect(e.indisler.barkod).toBe(0);
    expect(e.indisler.urunAdi).toBeNull();
    expect(e.sutunlar.marka).toBeNull();
    expect(e.skor).toBe(1);
  });
});

describe("urunOku", () => {
  it("başlıklı dosyayı okur ve sütun eşlemesini bildirir", async () => {
    const tampon = await kitapYap([
      ["Barkod", "Ürün Adı", "Görsel URL", "Marka", "Kategori", "Stok Kodu"],
      ["8680001", "Mavi Tişört", "https://cdn/1.jpg", "Marj", "Giyim", "STK-1"],
      ["8680002", "Kırmızı Şapka", "", "Marj", "Aksesuar", "STK-2"],
    ]);

    const sonuc = await urunOku(tampon);
    expect(sonuc.baslikSatiri).toBe(1);
    expect(sonuc.atlanan).toBe(0);
    expect(sonuc.sutunlar.barkod).toBe("Barkod");
    expect(sonuc.sutunlar.gorselUrl).toBe("Görsel URL");
    expect(sonuc.satirlar).toHaveLength(2);
    expect(sonuc.satirlar[0]).toEqual({
      barkod: "8680001",
      urunAdi: "Mavi Tişört",
      gorselUrl: "https://cdn/1.jpg",
      marka: "Marj",
      kategori: "Giyim",
      stokKodu: "STK-1",
    });
    expect(sonuc.satirlar[1]?.gorselUrl).toBe("");
  });

  it("başlık üstündeki dolgu satırlarını atlar", async () => {
    const tampon = await kitapYap([
      ["Marj Panel ürün listesi"],
      [],
      ["Barcode", "Product Name"],
      ["111", "Ürün A"],
    ]);

    const sonuc = await urunOku(tampon);
    expect(sonuc.baslikSatiri).toBe(3);
    expect(sonuc.satirlar).toEqual([
      { barkod: "111", urunAdi: "Ürün A", gorselUrl: "", marka: "", kategori: "", stokKodu: "" },
    ]);
  });

  it("barkodu boş satırı atlar, tamamen boş satırı saymaz", async () => {
    const tampon = await kitapYap([
      ["Barkod", "Ürün Adı"],
      ["111", "Ürün A"],
      ["", "Barkodsuz"],
      [],
      ["222", "Ürün B"],
    ]);

    const sonuc = await urunOku(tampon);
    expect(sonuc.atlanan).toBe(1);
    expect(sonuc.satirlar.map((s) => s.barkod)).toEqual(["111", "222"]);
  });

  it("sayısal barkodu metne çevirir", async () => {
    const tampon = await kitapYap([
      ["Barkod", "Ürün Adı"],
      [8680000000001, "Sayı barkod"],
    ]);

    const sonuc = await urunOku(tampon);
    expect(sonuc.satirlar[0]?.barkod).toBe("8680000000001");
  });

  it("barkod sütunu yoksa satır döndürmez", async () => {
    const tampon = await kitapYap([
      ["Ad", "Adet"],
      ["Ürün A", 3],
    ]);

    const sonuc = await urunOku(tampon);
    expect(sonuc.baslikSatiri).toBeNull();
    expect(sonuc.satirlar).toEqual([]);
    expect(sonuc.sutunlar.barkod).toBeNull();
  });
});
