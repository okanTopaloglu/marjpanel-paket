import { describe, it, expect, beforeEach, vi } from "vitest";
import { amazonSaglayicisi } from "./saglayici";
import { lwaUnut } from "./lwa";
import { siparisNormalle } from "./esle";

const KIMLIK = { sellerId: "A1SELLER", refreshToken: "Atzr|refresh" };
const UYGULAMA = { clientId: "amzn1.application-oa2-client.x", clientSecret: "gizli" };

const json = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { "content-type": "application/json" } });

const SIPARIS = {
  AmazonOrderId: "403-1234567-7654321",
  OrderStatus: "Unshipped",
  PurchaseDate: "2026-09-01T09:00:00Z",
  FulfillmentChannel: "MFN",
  ShippingAddress: { Name: "Ayşe Yılmaz", AddressLine1: "Örnek Sk 1", City: "İstanbul", County: "Kadıköy", Phone: "0532" },
};

function sahte(opts: { orders?: unknown; items?: unknown; rdt?: boolean } = {}) {
  const gorulen: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    gorulen.push({ url, init });
    if (url.includes("/auth/o2/token")) return json({ access_token: "LWA1", expires_in: 3600 });
    if (url.includes("/restrictedDataToken")) return opts.rdt ? json({ restrictedDataToken: "RDT1" }) : new Response("", { status: 403 });
    if (url.includes("/orderItems")) return json({ payload: { OrderItems: opts.items ?? [{ SellerSKU: "SKU-1", Title: "Krem", QuantityOrdered: 2 }] } });
    if (url.includes("/orders/v0/orders")) return json({ payload: { Orders: opts.orders ?? [SIPARIS], NextToken: null } });
    return new Response("", { status: 404 });
  };
  return { fetchImpl, gorulen };
}

beforeEach(() => {
  lwaUnut(KIMLIK.refreshToken);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("amazonSaglayicisi", () => {
  it("uygulama kimliği yoksa bağlantı testi bunu söyler, sipariş çekmez", async () => {
    const s = amazonSaglayicisi(KIMLIK, { uygulama: null, kalemArasiMs: 0, fetchImpl: sahte().fetchImpl });
    const t = await s.baglantiTest();
    expect(t.ok).toBe(false);
    expect(t.mesaj).toMatch(/AMAZON_LWA_CLIENT_ID/);
    await expect(s.siparisler({ baslangic: 0, bitis: 1, imlec: null })).rejects.toThrow(/uygulama kimliği/);
  });

  it("LWA refresh → x-amz-access-token; MFN filtresi, TR marketplace, kalemler ayrı istek; takip no = sipariş no", async () => {
    const f = sahte();
    const s = amazonSaglayicisi(KIMLIK, { uygulama: UYGULAMA, kalemArasiMs: 0, fetchImpl: f.fetchImpl });
    const sayfa = await s.siparisler({ baslangic: Date.UTC(2026, 8, 1), bitis: Date.UTC(2026, 8, 2), imlec: null });

    const lwa = f.gorulen[0]!;
    expect(lwa.url).toContain("/auth/o2/token");
    expect(String(lwa.init?.body)).toContain("grant_type=refresh_token");
    expect(String(lwa.init?.body)).toContain("client_id=amzn1.application-oa2-client.x");

    const liste = f.gorulen.find((g) => g.url.includes("/orders/v0/orders?"))!;
    expect((liste.init?.headers as Record<string, string>)["x-amz-access-token"]).toBe("LWA1");
    expect(liste.url).toContain("MarketplaceIds=A33AVAJ2PDY3EV");
    expect(liste.url).toContain("FulfillmentChannels=MFN");
    expect(liste.url).toContain("LastUpdatedAfter=2026-09-01T00%3A00%3A00.000Z");
    expect(f.gorulen.some((g) => g.url.includes("/restrictedDataToken"))).toBe(false);

    const [n] = sayfa.kayitlar;
    expect(n!.siparisKimligi).toBe("403-1234567-7654321");
    expect(n!.kargoTakipNo).toBe("403-1234567-7654321");
    expect(n!.durum).toBe("Picking");
    expect(n!.kalemler).toEqual([{ barkod: "SKU-1", urunAdi: "Krem", adet: 2, sku: "SKU-1" }]);
    expect(n!.adres).toEqual({ acik: "Örnek Sk 1", ilce: "Kadıköy", il: "İstanbul", telefon: "0532" });
    expect(sayfa.sonrakiImlec).toBeNull();
  }, 15_000);

  it("piiOnayli: RDT alınır ve liste isteğinde kullanılır; RDT 403 ise normal jetona düşer", async () => {
    const f = sahte({ rdt: true });
    await amazonSaglayicisi(KIMLIK, { ayarlar: { piiOnayli: true }, uygulama: UYGULAMA, kalemArasiMs: 0, fetchImpl: f.fetchImpl }).siparisler({ baslangic: 0, bitis: 1, imlec: null });
    const liste = f.gorulen.find((g) => g.url.includes("/orders/v0/orders?"))!;
    expect((liste.init?.headers as Record<string, string>)["x-amz-access-token"]).toBe("RDT1");

    lwaUnut(KIMLIK.refreshToken);
    const g = sahte({ rdt: false });
    await amazonSaglayicisi(KIMLIK, { ayarlar: { piiOnayli: true }, uygulama: UYGULAMA, kalemArasiMs: 0, fetchImpl: g.fetchImpl }).siparisler({ baslangic: 0, bitis: 1, imlec: null });
    const liste2 = g.gorulen.find((gg) => gg.url.includes("/orders/v0/orders?"))!;
    expect((liste2.init?.headers as Record<string, string>)["x-amz-access-token"]).toBe("LWA1");
  }, 15_000);

  it("NextToken imleç olarak taşınır; durum eşlemesi", async () => {
    const f = sahte({ orders: [] });
    const s = amazonSaglayicisi(KIMLIK, { uygulama: UYGULAMA, kalemArasiMs: 0, fetchImpl: f.fetchImpl });
    await s.siparisler({ baslangic: 0, bitis: 1, imlec: "NT-abc" });
    const liste = f.gorulen.find((g) => g.url.includes("/orders/v0/orders?"))!;
    expect(liste.url).toContain("NextToken=NT-abc");
    expect(liste.url).not.toContain("MarketplaceIds");

    const d = (OrderStatus: string) => siparisNormalle({ AmazonOrderId: "x", OrderStatus }, [])!.durum;
    expect(d("Pending")).toBe("Created");
    expect(d("Shipped")).toBe("Shipped");
    expect(d("Canceled")).toBe("Cancelled");
    expect(d("Unfulfillable")).toBe("UnSupplied");
    expect(d("InvoiceUnconfirmed")).toBe("Picking");
  });
});
