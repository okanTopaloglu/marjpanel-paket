import { describe, it, expect } from "vitest";
import { siparisEsle, urunEsle } from "./esle";

const SECENEK = { entegrasyonAdi: "Ana Magaza" };

describe("siparisEsle", () => {
  it("paket kimliğini shipmentPackageId'den alır", () => {
    const s = siparisEsle(
      { shipmentPackageId: 991, id: 12, orderNumber: "TY-1" },
      SECENEK,
    );
    expect(s?.siparisKimligi).toBe("991");
    expect(s?.siparisNo).toBe("TY-1");
  });

  it("shipmentPackageId yoksa id, o da yoksa orderNumber", () => {
    expect(siparisEsle({ id: 12, orderNumber: "TY-1" }, SECENEK)?.siparisKimligi).toBe("12");
    expect(siparisEsle({ orderNumber: "TY-1" }, SECENEK)?.siparisKimligi).toBe("TY-1");
    expect(siparisEsle({}, SECENEK)).toBeNull();
  });

  it("durum beyaz listeden geçer, tanınmayan durum Created olur", () => {
    expect(siparisEsle({ id: 1, status: "Picking" }, SECENEK)?.durum).toBe("Picking");
    expect(siparisEsle({ id: 1, status: "Uydurma" }, SECENEK)?.durum).toBe("Created");
    // Paket durumu sipariş durumunu ezer.
    expect(
      siparisEsle({ id: 1, status: "Created", shipmentPackageStatus: "Shipped" }, SECENEK)
        ?.durum,
    ).toBe("Shipped");
  });

  it("takip no önce satırdan, yoksa kökten okunur", () => {
    expect(
      siparisEsle(
        { id: 1, cargoTrackingNumber: "KOK", lines: [{ cargoTrackingNumber: "SATIR" }] },
        SECENEK,
      )?.kargoTakipNo,
    ).toBe("SATIR");
    expect(
      siparisEsle({ id: 1, cargoTrackingNumber: "KOK", lines: [{}] }, SECENEK)
        ?.kargoTakipNo,
    ).toBe("KOK");
    expect(siparisEsle({ id: 1 }, SECENEK)?.kargoTakipNo).toBeNull();
  });

  it("kargo firması kökten, yoksa satırdan; boşluklar kırpılır", () => {
    expect(
      siparisEsle({ id: 1, cargoProviderName: "  Aras Kargo " }, SECENEK)?.kargoFirmasi,
    ).toBe("Aras Kargo");
    expect(
      siparisEsle({ id: 1, lines: [{ cargoProviderName: "Yurtici" }] }, SECENEK)
        ?.kargoFirmasi,
    ).toBe("Yurtici");
  });

  it("epoch ms tarihi mutlak kabul edilir, saat ofseti UYGULANMAZ", () => {
    const ms = Date.UTC(2026, 2, 1, 9, 0, 0);
    const s = siparisEsle({ id: 1, orderDate: ms }, { ...SECENEK, saatOfseti: 3 });
    expect(s?.siparisTarihi?.getTime()).toBe(ms);
    // Metin hâlindeki epoch de aynı.
    expect(
      siparisEsle({ id: 1, orderDate: String(ms) }, { ...SECENEK, saatOfseti: 3 })
        ?.siparisTarihi?.getTime(),
    ).toBe(ms);
  });

  it("saat dilimi işaretli ISO kaydırılmaz, işaretsiz metin ofsetle kaydırılır", () => {
    const isaretli = siparisEsle(
      { id: 1, orderDate: "2026-03-01T09:00:00Z" },
      { ...SECENEK, saatOfseti: 3 },
    );
    expect(isaretli?.siparisTarihi?.toISOString()).toBe("2026-03-01T09:00:00.000Z");

    const isaretsiz = siparisEsle(
      { id: 1, orderDate: "2026-03-01T09:00:00" },
      { ...SECENEK, saatOfseti: 3 },
    );
    // 09:00 Türkiye = 06:00Z; süreç saat diliminden bağımsız.
    expect(isaretsiz?.siparisTarihi?.toISOString()).toBe("2026-03-01T06:00:00.000Z");
  });

  it("tarih yoksa null, bozuksa null", () => {
    expect(siparisEsle({ id: 1 }, SECENEK)?.siparisTarihi).toBeNull();
    expect(siparisEsle({ id: 1, orderDate: "abc" }, SECENEK)?.siparisTarihi).toBeNull();
  });

  it("içerik imzası barkoda göre sıralı üretilir", () => {
    const s = siparisEsle(
      {
        id: 1,
        lines: [
          { barcode: "B", quantity: 2 },
          { barcode: "A", quantity: 1 },
        ],
      },
      SECENEK,
    );
    expect(s?.icerikImzasi).toBe("A:1|B:2");
    expect(siparisEsle({ id: 1 }, SECENEK)?.icerikImzasi).toBeNull();
  });

  it("ham veri ve entegrasyon adı aynen taşınır", () => {
    const ham = { id: 1, ekstra: { a: 1 } };
    const s = siparisEsle(ham, SECENEK);
    expect(s?.hamVeri).toMatchObject(ham);
    expect(s?.hamVeri._normal).toBeTruthy();
    expect(s?.entegrasyonAdi).toBe("Ana Magaza");
    expect(s?.platform).toBe("trendyol");
  });
});

describe("urunEsle", () => {
  it("alanları eşler ve ilk görseli alır", () => {
    expect(
      urunEsle({
        barcode: " 869123 ",
        title: " Ürün A ",
        images: [{ url: "https://a/1.jpg" }, { url: "https://a/2.jpg" }],
        brand: "Marka",
        categoryName: "Kategori",
        stockCode: "STK-1",
      }),
    ).toEqual({
      barkod: "869123",
      urunAdi: "Ürün A",
      gorselUrl: "https://a/1.jpg",
      marka: "Marka",
      kategori: "Kategori",
      stokKodu: "STK-1",
    });
  });

  it("barkodsuz ve arşivlenmiş ürün atlanır", () => {
    expect(urunEsle({ title: "x" })).toBeNull();
    expect(urunEsle({ barcode: "1", archived: true })).toBeNull();
  });

  it("eksik alanlar null döner", () => {
    expect(urunEsle({ barcode: "1" })).toEqual({
      barkod: "1",
      urunAdi: null,
      gorselUrl: null,
      marka: null,
      kategori: null,
      stokKodu: null,
    });
  });
});
