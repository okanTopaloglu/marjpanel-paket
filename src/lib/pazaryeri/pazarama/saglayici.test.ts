import { describe, it, expect, beforeEach } from "vitest";
import { pazaramaSaglayicisi } from "./saglayici";
import { jetonuUnut } from "./jeton";
import { durumMetniniCoz, siparisNormalle } from "./esle";
import { zarfCoz } from "./istemci";

const KIMLIK = { clientId: "CID", clientSecret: "CSEC" };

const json = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { "content-type": "application/json" } });

/** Jeton ucu + API ucunu ayıran sahte fetch. */
function sahte(apiYaniti: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const gorulen: { url: string; init?: RequestInit }[] = [];
  let jetonSayaci = 0;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    gorulen.push({ url, init });
    if (url.includes("/connect/token")) {
      jetonSayaci++;
      return json({ data: { accessToken: `J${jetonSayaci}`, expiresIn: 3600 } });
    }
    return apiYaniti(url, init);
  };
  return { fetchImpl, gorulen, jetonSayisi: () => jetonSayaci };
}

beforeEach(() => jetonuUnut(KIMLIK.clientId));

describe("pazaramaSaglayicisi", () => {
  it("jeton Basic client_credentials ile alınır, önbellekten tekrar kullanılır; sipariş POST form-urlencoded", async () => {
    const f = sahte(() => json({ data: [], totalPages: 1 }));
    const s = pazaramaSaglayicisi(KIMLIK, { fetchImpl: f.fetchImpl });
    await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });

    const jeton = f.gorulen[0]!;
    expect(jeton.url).toContain("/connect/token");
    expect((jeton.init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("CID:CSEC").toString("base64")}`,
    );
    expect(String(jeton.init?.body)).toContain("grant_type=client_credentials");
    expect(String(jeton.init?.body)).toContain("scope=merchantgatewayapi.fullaccess");
    expect(f.jetonSayisi()).toBe(1);

    const api = f.gorulen[1]!;
    expect(api.url).toContain("/order/getOrdersForApi");
    expect(api.init?.method).toBe("POST");
    expect((api.init?.headers as Record<string, string>).Authorization).toBe("Bearer J1");
    expect(String(api.init?.body)).toMatch(/StartDate=1970-01-01T00%3A00%3A00\.000Z/);
    expect(String(api.init?.body)).toContain("Page=1&Size=100");
  });

  it("401'de jeton bir kez tazelenip istek yinelenir; ikinci 401 kimlik hatasıdır", async () => {
    let cagri = 0;
    const f = sahte(() => (cagri++ === 0 ? new Response("", { status: 401 }) : json({ data: [] })));
    const s = pazaramaSaglayicisi(KIMLIK, { fetchImpl: f.fetchImpl });
    const sayfa = await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    expect(sayfa.kayitlar).toEqual([]);
    expect(f.jetonSayisi()).toBe(2);

    jetonuUnut(KIMLIK.clientId);
    const hep401 = sahte(() => new Response("", { status: 401 }));
    const t = await pazaramaSaglayicisi(KIMLIK, { fetchImpl: hep401.fetchImpl }).baglantiTest();
    expect(t.ok).toBe(false);
    expect(t.mesaj).toMatch(/reddedildi/);
  });

  it("zarf çözümü: data[], data.items[], items[]; sayfa bilgisi iç ya da dış", () => {
    expect(zarfCoz({ data: [1, 2] }).liste).toEqual([1, 2]);
    expect(zarfCoz({ data: { items: [3], totalPages: 4 } })).toMatchObject({ liste: [3], toplamSayfa: 4 });
    expect(zarfCoz({ items: [5], totalCount: 9 })).toMatchObject({ liste: [5], toplam: 9 });
    expect(zarfCoz(null).liste).toEqual([]);
  });

  it("sipariş → normal: aday alanlar, sayısal ve metin durumlar", () => {
    const n = siparisNormalle({
      orderNumber: "PZ-1",
      packageNumber: "PK-1",
      status: 12,
      orderDate: "2026-09-01T09:00:00",
      customerFullName: "Ayşe Yılmaz",
      cargoCompanyName: "Aras",
      cargoTrackingNumber: "PZ123",
      shippingAddress: { address: "Örnek Sk 1", city: "İstanbul", district: "Kadıköy", gsm: "0532" },
      orderItems: [{ productName: "Krem", stockCode: "STK-1", quantity: 2 }],
    })!;
    expect(n.siparisKimligi).toBe("PK-1");
    expect(n.siparisNo).toBe("PZ-1");
    expect(n.durum).toBe("Picking");
    expect(n.hamDurum).toBe("12");
    expect(n.kargoTakipNo).toBe("PZ123");
    expect(n.adres).toEqual({ acik: "Örnek Sk 1", ilce: "Kadıköy", il: "İstanbul", telefon: "0532" });
    expect(n.kalemler).toEqual([{ barkod: "STK-1", urunAdi: "Krem", adet: 2, sku: "STK-1" }]);
    expect(n.siparisTarihi?.toISOString()).toBe("2026-09-01T06:00:00.000Z");

    expect(siparisNormalle({ orderNumber: "x", status: 5 })!.durum).toBe("Shipped");
    expect(siparisNormalle({ orderNumber: "x", status: "Siparişiniz Kargoya Verildi" })!.durum).toBe("Shipped");
    expect(siparisNormalle({ orderNumber: "x", status: "Teslim Edildi" })!.durum).toBe("Delivered");
    expect(siparisNormalle({ orderNumber: "x", status: "İptal Edildi" })!.durum).toBe("Cancelled");
    expect(siparisNormalle({})).toBeNull();
    expect(durumMetniniCoz("Teslim Edilemedi")).toBe("UnDelivered");
  });

  it("ürünler: Bearer GET, Approved=true, Page 1 tabanlı; dolmamış sayfa bitiş", async () => {
    const f = sahte((url) => {
      expect(url).toContain("/product/products?Approved=true&Page=1&Size=100");
      return json({ data: [{ code: "PC-1", barcode: "869", name: "Krem", brandName: "MA", imageUrls: ["https://x/1.jpg"] }] });
    });
    const u = await pazaramaSaglayicisi(KIMLIK, { fetchImpl: f.fetchImpl }).urunler!({ imlec: null });
    expect(u.kayitlar).toEqual([{ barkod: "869", urunAdi: "Krem", gorselUrl: "https://x/1.jpg", marka: "MA", kategori: null, stokKodu: "PC-1" }]);
    expect(u.sonrakiImlec).toBeNull();
  });
});
