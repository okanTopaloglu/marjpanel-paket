import { describe, it, expect } from "vitest";
import { idefixSaglayicisi } from "./saglayici";
import { SIPARIS_SAYFA_BOYUTU, idefixTarih } from "./istemci";
import { sevkiyatNormalle } from "./esle";

const KIMLIK = { vendorId: "778", apiKey: "8ce68391-d7b3", apiSecret: "16ae16os-d82e" };

const json = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { "content-type": "application/json" } });

const SEVKIYAT = {
  id: 90001,
  orderNumber: "IDX-1",
  status: "shipment_ready",
  cargoCompany: "Hepsijet",
  cargoTrackingNumber: "IPH123",
  orderDate: "2026/09/01 12:30:00",
  customerContactName: "A. Yılmaz",
  customerTcNumber: "11111111111",
  shippingAddress: {
    firstName: "Ayşe",
    lastName: "Yılmaz",
    address1: "Örnek Sk.",
    neighborhood: "Merkez Mah.",
    buildingNumber: "1",
    doorNumber: "5",
    city: "İstanbul",
    county: "Kadıköy",
    phone: "05321112233",
  },
  items: [
    { productName: "Krem", barcode: "869", merchantSku: "SKU-1", quantity: 2 },
    { productName: "Şampuan", merchantSku: "SKU-2" },
  ],
};

describe("idefixSaglayicisi", () => {
  it("X-API-KEY base64(apiKey:apiSecret), vendor yolda, tarih yyyy/MM/dd HH:mm:ss TR, sayfa 1 tabanlı", async () => {
    let basliklar: Record<string, string> = {};
    let url = "";
    const s = idefixSaglayicisi(KIMLIK, {
      fetchImpl: async (u, init) => {
        url = u;
        basliklar = init?.headers as Record<string, string>;
        return json({ totalCount: 1, pageCount: 1, currentPage: 1, items: [SEVKIYAT] });
      },
    });
    const bas = Date.UTC(2026, 8, 1, 21, 0); // 00:00 TR
    const sayfa = await s.siparisler({ baslangic: bas, bitis: bas + 60_000, imlec: null });
    expect(basliklar["X-API-KEY"]).toBe(Buffer.from("8ce68391-d7b3:16ae16os-d82e").toString("base64"));
    expect(url).toContain("/oms/778/list");
    expect(url).toContain(`startDate=${encodeURIComponent("2026/09/02 00:00:00")}`);
    expect(url).toContain(`page=1&limit=${SIPARIS_SAYFA_BOYUTU}`);
    expect(sayfa.sonrakiImlec).toBeNull();
    expect(sayfa.sayfaNo).toBe(0);
  });

  it("sevkiyat → normal: kimlik id, durum eşlemesi, adres/kalemler", () => {
    const n = sevkiyatNormalle(SEVKIYAT)!;
    expect(n.platform).toBe("idefix");
    expect(n.siparisKimligi).toBe("90001");
    expect(n.siparisNo).toBe("IDX-1");
    expect(n.kargoTakipNo).toBe("IPH123");
    expect(n.durum).toBe("Created");
    expect(n.musteriAd).toBe("Ayşe Yılmaz");
    expect(n.adres).toEqual({ acik: "Merkez Mah. Örnek Sk. No:1 D:5", ilce: "Kadıköy", il: "İstanbul", telefon: "05321112233" });
    expect(n.kalemler).toEqual([
      { barkod: "869", urunAdi: "Krem", adet: 2, sku: "SKU-1" },
      { barkod: "SKU-2", urunAdi: "Şampuan", adet: 1, sku: "SKU-2" },
    ]);
    expect(n.siparisTarihi?.toISOString()).toBe("2026-09-01T09:30:00.000Z");
    const d = (status: string) => sevkiyatNormalle({ id: 1, status })!.durum;
    expect(d("shipment_picking")).toBe("Picking");
    expect(d("shipment_in_cargo")).toBe("Shipped");
    expect(d("shipment_approved")).toBe("Delivered");
    expect(d("shipment_unsupplied")).toBe("UnSupplied");
    expect(d("shipment_cancelled")).toBe("Cancelled");
  });

  it("sayfalama: pageCount'a varış bitiştir; ürünler products[] zarfı", async () => {
    const dolu = Array.from({ length: SIPARIS_SAYFA_BOYUTU }, (_, i) => ({ ...SEVKIYAT, id: i + 1 }));
    let cagri = 0;
    const s = idefixSaglayicisi(KIMLIK, {
      fetchImpl: async (u) => {
        if (u.includes("/pim/pool/")) {
          return json({ products: [{ barcode: "869", title: "Krem", images: ["https://x/1.jpg"], productMainId: "PM-1" }, { title: "barkodsuz" }] });
        }
        return json(cagri++ === 0 ? { pageCount: 2, currentPage: 1, items: dolu } : { pageCount: 2, currentPage: 2, items: [SEVKIYAT] });
      },
    });
    const ilk = await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    expect(ilk.sonrakiImlec).toBe("2");
    const son = await s.siparisler({ baslangic: 0, bitis: 1, imlec: "2" });
    expect(son.sonrakiImlec).toBeNull();
    const u = await s.urunler!({ imlec: null });
    expect(u.kayitlar).toEqual([{ barkod: "869", urunAdi: "Krem", gorselUrl: "https://x/1.jpg", marka: null, kategori: null, stokKodu: "PM-1" }]);
    expect(u.sonrakiImlec).toBeNull();
  });

  it("bağlantı testi ve tarih biçimi", async () => {
    const t = async (status: number) =>
      idefixSaglayicisi(KIMLIK, { fetchImpl: async () => new Response("", { status }) }).baglantiTest();
    expect((await t(401)).ok).toBe(false);
    expect((await t(404)).mesaj).toMatch(/Vendor ID/);
    expect((await t(200)).ok).toBe(true);
    expect(idefixTarih(Date.UTC(2026, 0, 1, 21, 5, 9))).toBe("2026/01/02 00:05:09");
  });
});
