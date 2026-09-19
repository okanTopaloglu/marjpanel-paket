import { describe, it, expect } from "vitest";
import { httpIstemci, tekrarSaniyesi } from "../http";
import {
  PazaryeriBaglantiHatasi,
  PazaryeriHatasi,
  PazaryeriHizSiniri,
  PazaryeriKimlikHatasi,
} from "../hatalar";

const yanit = (govde: unknown, init: ResponseInit = {}) =>
  new Response(typeof govde === "string" ? govde : JSON.stringify(govde), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

describe("httpIstemci", () => {
  it("200'de JSON döner ve ortak başlıkları taşır", async () => {
    let gorulen: RequestInit | undefined;
    const http = httpIstemci({
      platform: "trendyol",
      basliklar: { Authorization: "Basic x" },
      fetchImpl: async (_u, init) => {
        gorulen = init;
        return yanit({ a: 1 });
      },
    });
    expect(await http.jsonAl<{ a: number }>("https://x")).toEqual({ a: 1 });
    expect((gorulen?.headers as Record<string, string>).Authorization).toBe("Basic x");
  });

  it("429 → PazaryeriHizSiniri, Retry-After saniye olarak okunur", async () => {
    const http = httpIstemci({
      platform: "trendyol",
      fetchImpl: async () => yanit("çok istek", { status: 429, headers: { "retry-after": "17" } }),
    });
    await expect(http.jsonAl("https://x")).rejects.toBeInstanceOf(PazaryeriHizSiniri);
    try {
      await http.jsonAl("https://x");
    } catch (h) {
      expect((h as PazaryeriHizSiniri).tekrarSaniye).toBe(17);
      expect((h as PazaryeriHizSiniri).platform).toBe("trendyol");
    }
  });

  it("401/403 → PazaryeriKimlikHatasi; diğer 4xx/5xx → PazaryeriHatasi", async () => {
    for (const durum of [401, 403]) {
      const http = httpIstemci({ platform: "trendyol", fetchImpl: async () => yanit("", { status: durum }) });
      await expect(http.jsonAl("https://x")).rejects.toBeInstanceOf(PazaryeriKimlikHatasi);
    }
    const http = httpIstemci({ platform: "trendyol", fetchImpl: async () => yanit("bozuk", { status: 500 }) });
    const hata = await http.jsonAl("https://x").catch((h) => h);
    expect(hata).toBeInstanceOf(PazaryeriHatasi);
    expect(hata).not.toBeInstanceOf(PazaryeriKimlikHatasi);
    expect((hata as PazaryeriHatasi).durumKodu).toBe(500);
  });

  it("geçersiz JSON → PazaryeriHatasi", async () => {
    const http = httpIstemci({ platform: "trendyol", fetchImpl: async () => yanit("<html>") });
    await expect(http.jsonAl("https://x")).rejects.toBeInstanceOf(PazaryeriHatasi);
  });

  it("ağ hatası → PazaryeriBaglantiHatasi; zaman aşımı mesajda görünür", async () => {
    const http = httpIstemci({
      platform: "trendyol",
      fetchImpl: async () => {
        throw new Error("ECONNRESET");
      },
    });
    await expect(http.istek("https://x")).rejects.toBeInstanceOf(PazaryeriBaglantiHatasi);

    const yavas = httpIstemci({
      platform: "trendyol",
      zamanAsimiMs: 10,
      fetchImpl: (_u, init) =>
        new Promise((_r, reddet) => {
          init?.signal?.addEventListener("abort", () => reddet(new Error("aborted")));
        }),
    });
    await expect(yavas.istek("https://x")).rejects.toThrow(/zaman aşımı/);
  });
});

describe("tekrarSaniyesi", () => {
  it("sayı ve HTTP tarihi biçimlerini çözer, yoksa null", () => {
    expect(tekrarSaniyesi(new Response("", { headers: { "retry-after": "5" } }))).toBe(5);
    const ileri = new Date(Date.now() + 30_000).toUTCString();
    const t = tekrarSaniyesi(new Response("", { headers: { "retry-after": ileri } }));
    expect(t).toBeGreaterThanOrEqual(28);
    expect(t).toBeLessThanOrEqual(31);
    expect(tekrarSaniyesi(new Response(""))).toBeNull();
  });
});
