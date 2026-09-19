import { describe, it, expect } from "vitest";
import { n11Saglayicisi } from "./saglayici";
import { SIPARIS_SAYFA_BOYUTU, URUN_SAYFA_BOYUTU } from "./istemci";

const KIMLIK = { appKey: "AK", appSecret: "AS" };

const json = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { "content-type": "application/json" } });

describe("n11Saglayicisi", () => {
  it("appkey/appsecret başlıkla gider, Trendyol alanları normal siparişe iner", async () => {
    let basliklar: Record<string, string> = {};
    let url = "";
    const s = n11Saglayicisi(KIMLIK, {
      fetchImpl: async (u, init) => {
        url = u;
        basliklar = init?.headers as Record<string, string>;
        return json({
          content: [
            {
              id: 5001,
              orderNumber: "N11-1",
              shipmentPackageStatus: "Picking",
              cargoTrackingNumber: "TK-N11",
              cargoProviderName: "Sürat Kargo",
              orderDate: Date.UTC(2026, 8, 1),
              customerfullName: "Ayşe Yılmaz",
              shippingAddress: { address: "Örnek Sk 1", city: "İstanbul", district: "Kadıköy", gsm: "0532" },
              lines: [{ productName: "Krem", stockCode: "STK-1", quantity: 2 }],
            },
          ],
          totalPages: 1,
        });
      },
    });
    const sayfa = await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    expect(basliklar.appkey).toBe("AK");
    expect(basliklar.appsecret).toBe("AS");
    expect(url).toContain("/rest/delivery/v1/shipmentPackages");
    expect(url).toContain(`size=${SIPARIS_SAYFA_BOYUTU}`);

    const n = sayfa.kayitlar[0]!;
    expect(n.platform).toBe("n11");
    expect(n.siparisKimligi).toBe("5001");
    expect(n.kargoTakipNo).toBe("TK-N11");
    expect(n.durum).toBe("Picking");
    expect(n.adres.il).toBe("İstanbul");
    // Barkodsuz kalem stok koduna düşer.
    expect(n.kalemler[0]).toMatchObject({ barkod: "STK-1", sku: "STK-1", adet: 2 });
    expect(sayfa.sonrakiImlec).toBeNull();
  });

  it("ürünler: farklı zarf adları kabul edilir, boş sayfa bitiştir", async () => {
    const dolu = Array.from({ length: URUN_SAYFA_BOYUTU }, (_, i) => ({
      stockCode: `S${i}`,
      barcode: `B${i}`,
      title: `Ürün ${i}`,
      imageUrls: [`https://x/${i}.jpg`],
    }));
    let cagri = 0;
    const s = n11Saglayicisi(KIMLIK, {
      fetchImpl: async () => json(cagri++ === 0 ? { items: dolu } : { items: [] }),
    });
    const ilk = await s.urunler!({ imlec: null });
    expect(ilk.kayitlar).toHaveLength(URUN_SAYFA_BOYUTU);
    expect(ilk.kayitlar[0]).toMatchObject({ barkod: "B0", urunAdi: "Ürün 0", gorselUrl: "https://x/0.jpg", stokKodu: "S0" });
    expect(ilk.sonrakiImlec).toBe("1");
    const son = await s.urunler!({ imlec: "1" });
    expect(son.kayitlar).toHaveLength(0);
    expect(son.sonrakiImlec).toBeNull();
  });

  it("bağlantı testi: 401 anahtar hatası, 429 başarı", async () => {
    const t = async (status: number) =>
      n11Saglayicisi(KIMLIK, { fetchImpl: async () => new Response("", { status }) }).baglantiTest();
    expect((await t(401)).ok).toBe(false);
    expect((await t(429)).ok).toBe(true);
    expect((await t(200)).ok).toBe(true);
  });
});
