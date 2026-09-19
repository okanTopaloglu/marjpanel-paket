import { PazaryeriKimlikHatasi } from "../hatalar";
import { httpIstemci, type FetchImpl } from "../http";
import type { BaglantiTestSonucu } from "../tipler";
import { jetonAl, jetonuUnut } from "./jeton";

/**
 * PAZARAMA API İSTEMCİSİ — yalnız sunucu. Belge: docs/pazaryeri/pazarama.md.
 *
 * Bearer jeton `jeton.ts`ten gelir; 401'de jeton BİR KEZ tazelenip istek
 * yinelenir (jeton süresi dolmuş olabilir, anahtar yanlış değil). İkinci 401
 * gerçek kimlik hatasıdır ve öyle fırlatılır.
 *
 * Sipariş ucu POST + form-urlencoded (iki bağımsız istemci böyle); zarf
 * değişken olduğundan liste birkaç adla aranır.
 */
export const PAZARAMA_TABAN =
  process.env.PAZARAMA_API_BASE?.trim() || "https://isortagimapi.pazarama.com";

export const SIPARIS_SAYFA_BOYUTU = 100;
export const URUN_SAYFA_BOYUTU = 100;

export type HamSiparis = Record<string, unknown>;
export type HamUrun = Record<string, unknown>;

export interface PazaramaKimlik {
  clientId: string;
  clientSecret: string;
}

export interface Zarf<T> {
  liste: T[];
  toplamSayfa?: number;
  toplam?: number;
}

export interface PazaramaIstemcisi {
  siparisler(p: { baslangic: number; bitis: number; sayfa: number }): Promise<Zarf<HamSiparis>>;
  urunler(p: { sayfa: number; onayli?: boolean }): Promise<Zarf<HamUrun>>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

/** `{data:[...]}`, `{data:{data|items:[...]}}`, `{items:[...]}` — hepsini düzler. */
export function zarfCoz<T>(veri: unknown): Zarf<T> {
  if (Array.isArray(veri)) return { liste: veri as T[] };
  const kok = (veri ?? {}) as Record<string, unknown>;
  const ic =
    kok.data && typeof kok.data === "object" && !Array.isArray(kok.data)
      ? (kok.data as Record<string, unknown>)
      : kok;
  const liste = [kok.data, ic.data, ic.items, kok.items, ic.orders, ic.products].find(Array.isArray) as
    | T[]
    | undefined;
  const sayi = (k: string) =>
    typeof ic[k] === "number" ? (ic[k] as number) : typeof kok[k] === "number" ? (kok[k] as number) : undefined;
  return {
    liste: liste ?? [],
    toplamSayfa: sayi("totalPages") ?? sayi("pageCount"),
    toplam: sayi("totalCount") ?? sayi("totalElements"),
  };
}

export function pazaramaIstemcisi(
  { clientId, clientSecret }: PazaramaKimlik,
  { fetchImpl, taban = PAZARAMA_TABAN }: { fetchImpl?: FetchImpl; taban?: string } = {},
): PazaramaIstemcisi {
  const http = httpIstemci({ platform: "pazarama", fetchImpl, basliklar: { Accept: "application/json" } });

  async function yetkili<T>(url: string, init: RequestInit): Promise<T> {
    const dene = async (): Promise<T> => {
      const jeton = await jetonAl(clientId, clientSecret, { fetchImpl });
      return http.jsonAl<T>(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${jeton}` },
      });
    };
    try {
      return await dene();
    } catch (hata) {
      if (hata instanceof PazaryeriKimlikHatasi && hata.durumKodu === 401) {
        jetonuUnut(clientId);
        return dene();
      }
      throw hata;
    }
  }

  const siparisIstegi = (baslangic: number, bitis: number, sayfa: number, boyut: number): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      StartDate: new Date(baslangic).toISOString(),
      EndDate: new Date(bitis).toISOString(),
      Page: String(sayfa),
      Size: String(boyut),
    }).toString(),
  });

  return {
    async siparisler({ baslangic, bitis, sayfa }) {
      return zarfCoz<HamSiparis>(
        await yetkili<unknown>(`${taban}/order/getOrdersForApi`, siparisIstegi(baslangic, bitis, sayfa, SIPARIS_SAYFA_BOYUTU)),
      );
    },

    async urunler({ sayfa, onayli = true }) {
      const url = `${taban}/product/products?Approved=${onayli}&Page=${sayfa}&Size=${URUN_SAYFA_BOYUTU}`;
      return zarfCoz<HamUrun>(await yetkili<unknown>(url, { method: "GET" }));
    },

    async baglantiTest(): Promise<BaglantiTestSonucu> {
      const simdi = Date.now();
      try {
        await yetkili<unknown>(`${taban}/order/getOrdersForApi`, siparisIstegi(simdi - 3_600_000, simdi, 1, 1));
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        if (hata instanceof PazaryeriKimlikHatasi) {
          return { ok: false, mesaj: `API Key / API Secret reddedildi (${hata.durumKodu}).` };
        }
        return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
      }
    },
  };
}
