import { httpIstemci, type FetchImpl } from "../http";
import type { BaglantiTestSonucu } from "../tipler";

/**
 * TRENDYOL API İSTEMCİSİ — yalnız sunucu.
 *
 * Başlıklar, zaman aşımı ve hata sınıfları ortak `http.ts`ten gelir; burada
 * yalnız Trendyol'un URL şekli ve sayfalı yanıt zarfı vardır. Çağıran hata
 * TÜRÜNE bakarak karar verir (429'da o entegrasyonu bırak, 401'de
 * kullanıcıya "anahtar hatalı" de) — metin ayrıştırmaz.
 */

export const TRENDYOL_TABAN =
  process.env.TRENDYOL_API_BASE?.trim() || "https://apigw.trendyol.com";

/** Sayfa boyutu — Trendyol'un izin verdiği azami değer. */
export const SAYFA_BOYUTU = 200;

/** Trendyol sayfalı yanıt zarfı. */
export interface SayfaliYanit<T> {
  content: T[];
  totalPages?: number;
  totalElements?: number;
  page?: number;
  size?: number;
}

/** Sipariş kaydı ham hâliyle taşınır; alan eşleme `esle.ts` işidir. */
export type HamSiparis = Record<string, unknown>;
export type HamUrun = Record<string, unknown>;

export interface TrendyolKimlik {
  saticiId: string;
  apiKey: string;
  apiSecret: string;
}

export interface SiparisParametreleri {
  /** Epoch ms (dâhil). */
  baslangic: number;
  /** Epoch ms (dâhil). */
  bitis: number;
  /** 0 tabanlı sayfa numarası. */
  sayfa: number;
}

export interface UrunParametreleri {
  sayfa: number;
  /** Yalnız onaylı ürünler (varsayılan true). */
  onayli?: boolean;
}

export interface TrendyolIstemcisi {
  siparisler(p: SiparisParametreleri): Promise<SayfaliYanit<HamSiparis>>;
  urunler(p: UrunParametreleri): Promise<SayfaliYanit<HamUrun>>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

function zarf<T>(veri: unknown): SayfaliYanit<T> {
  const z = (veri ?? {}) as Record<string, unknown>;
  return {
    content: Array.isArray(z.content) ? (z.content as T[]) : [],
    totalPages: typeof z.totalPages === "number" ? z.totalPages : undefined,
    totalElements: typeof z.totalElements === "number" ? z.totalElements : undefined,
    page: typeof z.page === "number" ? z.page : undefined,
    size: typeof z.size === "number" ? z.size : undefined,
  };
}

export function trendyolIstemcisi(
  { saticiId, apiKey, apiSecret }: TrendyolKimlik,
  { fetchImpl, taban = TRENDYOL_TABAN }: { fetchImpl?: FetchImpl; taban?: string } = {},
): TrendyolIstemcisi {
  const yetki = Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString("base64");
  const http = httpIstemci({
    platform: "trendyol",
    fetchImpl,
    basliklar: {
      Authorization: `Basic ${yetki}`,
      // Trendyol self-integration sözleşmesi: satıcı kimliği User-Agent'ta.
      "User-Agent": `${saticiId} - SelfIntegration`,
      Accept: "application/json",
    },
  });

  return {
    async siparisler({ baslangic, bitis, sayfa }) {
      const url =
        `${taban}/integration/order/sellers/${saticiId}/orders` +
        `?startDate=${baslangic}&endDate=${bitis}&size=${SAYFA_BOYUTU}&page=${sayfa}` +
        `&orderByField=CreatedDate&orderByDirection=DESC`;
      return zarf<HamSiparis>(await http.jsonAl(url));
    },

    async urunler({ sayfa, onayli = true }) {
      const url =
        `${taban}/integration/product/sellers/${saticiId}/products` +
        `?page=${sayfa}&size=${SAYFA_BOYUTU}&approved=${onayli}`;
      return zarf<HamUrun>(await http.jsonAl(url));
    },

    /**
     * Bağlantı testi tek kayıt ister. 429 BAŞARIDIR: hız sınırına takılmak
     * kimliğin DOĞRULANDIĞI anlamına gelir (yanlış anahtar 401 alırdı).
     */
    async baglantiTest(): Promise<BaglantiTestSonucu> {
      const url = `${taban}/integration/order/sellers/${saticiId}/orders?size=1`;
      try {
        const yanit = await http.istek(url);
        if (yanit.status === 429) {
          return { ok: true, mesaj: "Bağlantı kuruldu (hız sınırı, kimlik geçerli)." };
        }
        if (yanit.status === 401 || yanit.status === 403) {
          return {
            ok: false,
            mesaj: `API anahtarı veya gizli anahtar hatalı (${yanit.status}).`,
          };
        }
        if (yanit.status === 404) {
          return { ok: false, mesaj: "Satıcı kimliği bulunamadı. Satıcı ID'yi kontrol edin." };
        }
        if (!yanit.ok) {
          const govde = await http.govdeOku(yanit);
          return {
            ok: false,
            mesaj: `Trendyol hata verdi (${yanit.status}): ${govde.slice(0, 160)}`,
          };
        }
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        const mesaj = hata instanceof Error ? hata.message : String(hata);
        return { ok: false, mesaj };
      }
    },
  };
}
