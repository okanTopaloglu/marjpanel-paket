import { describe, it, expect } from "vitest";
import { trendyolSaglayicisi } from "./saglayici";
import { SAYFA_BOYUTU } from "./istemci";

const KIMLIK = { saticiId: "42", apiKey: "k", apiSecret: "s" };

function sahteFetch(sayfalar: Record<string, unknown>[][], toplamSayfa?: number) {
  const gorulenUrl: string[] = [];
  const fetchImpl = async (url: string) => {
    gorulenUrl.push(url);
    const sayfa = Number(new URL(url).searchParams.get("page") ?? 0);
    const content = sayfalar[sayfa] ?? [];
    return new Response(JSON.stringify({ content, totalPages: toplamSayfa ?? sayfalar.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, gorulenUrl };
}

describe("trendyolSaglayicisi", () => {
  it("imleç sayfa numarasıdır; dolmamış sayfa ya da totalPages'e varış son sayfadır", async () => {
    const dolu = Array.from({ length: SAYFA_BOYUTU }, (_, i) => ({ id: i + 1 }));
    const { fetchImpl, gorulenUrl } = sahteFetch([dolu, [{ id: 999 }]]);
    const s = trendyolSaglayicisi(KIMLIK, { fetchImpl });

    const ilk = await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    expect(ilk.kayitlar).toHaveLength(SAYFA_BOYUTU);
    expect(ilk.sonrakiImlec).toBe("1");
    expect(ilk.sayfaNo).toBe(0);
    expect(ilk.toplamSayfa).toBe(2);

    const son = await s.siparisler({ baslangic: 0, bitis: 1, imlec: ilk.sonrakiImlec });
    expect(son.kayitlar.map((k) => k.siparisKimligi)).toEqual(["999"]);
    expect(son.sonrakiImlec).toBeNull();
    expect(gorulenUrl[1]).toContain("page=1");
    expect(gorulenUrl[1]).toContain("/sellers/42/orders");
  });

  it("Basic yetki ve SelfIntegration User-Agent başlıkları gider", async () => {
    let basliklar: Record<string, string> = {};
    const s = trendyolSaglayicisi(KIMLIK, {
      fetchImpl: async (_u, init) => {
        basliklar = init?.headers as Record<string, string>;
        return new Response(JSON.stringify({ content: [] }), { status: 200 });
      },
    });
    await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    expect(basliklar.Authorization).toBe(`Basic ${Buffer.from("k:s").toString("base64")}`);
    expect(basliklar["User-Agent"]).toBe("42 - SelfIntegration");
  });

  it("bağlantı testi: 429 başarı sayılır, 401 anahtar hatası, 404 satıcı yok", async () => {
    const testi = async (status: number) =>
      trendyolSaglayicisi(KIMLIK, {
        fetchImpl: async () => new Response("", { status }),
      }).baglantiTest();
    expect((await testi(200)).ok).toBe(true);
    expect((await testi(429)).ok).toBe(true);
    expect((await testi(401)).ok).toBe(false);
    expect((await testi(404)).mesaj).toMatch(/Satıcı kimliği/);
  });

  it("ürünler: arşivli ve barkodsuz atlanır, imleç ilerler", async () => {
    const s = trendyolSaglayicisi(KIMLIK, {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            content: [{ barcode: "1", title: "A" }, { barcode: "2", archived: true }, { title: "x" }],
            totalPages: 1,
          }),
          { status: 200 },
        ),
    });
    const u = await s.urunler!({ imlec: null });
    expect(u.kayitlar.map((k) => k.barkod)).toEqual(["1"]);
    expect(u.sonrakiImlec).toBeNull();
  });
});
