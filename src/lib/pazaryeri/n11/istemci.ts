import { httpIstemci, type FetchImpl } from "../http";
import type { BaglantiTestSonucu } from "../tipler";

/**
 * N11 REST API İSTEMCİSİ — yalnız sunucu. Belge: docs/pazaryeri/n11.md.
 *
 * Kimlik iki BAŞLIKTIR (`appkey`, `appsecret`), Basic auth değil. Sipariş ucu
 * Trendyol'la aynı zarfı (`content` + `totalPages`) ve aynı alan adlarını
 * kullanır; eşleme bu yüzden Trendyol eşlemesini yeniden kullanır (esle.ts).
 * Ürün ucu ayrı bir servistir (`/ms/product-query`), alanları farklıdır.
 */
export const N11_TABAN = process.env.N11_API_BASE?.trim() || "https://api.n11.com";

/** Sipariş sayfası azami 100, ürün sayfası azami 250 (portal). */
export const SIPARIS_SAYFA_BOYUTU = 100;
export const URUN_SAYFA_BOYUTU = 250;

export interface SayfaliYanit<T> {
  content: T[];
  totalPages?: number;
  totalElements?: number;
  page?: number;
  size?: number;
}

export type HamSiparis = Record<string, unknown>;
export type HamUrun = Record<string, unknown>;

export interface N11Kimlik {
  appKey: string;
  appSecret: string;
}

export interface N11Istemcisi {
  siparisler(p: { baslangic: number; bitis: number; sayfa: number }): Promise<SayfaliYanit<HamSiparis>>;
  urunler(p: { sayfa: number }): Promise<SayfaliYanit<HamUrun>>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

/**
 * N11 ürün servisinin zarfı belgede tam gösterilmiyor; `content`, `items`
 * ya da `products` altında liste gelebilir. Üçünü de kabul eder, sayfa
 * bilgisini bulduğu adla okur.
 */
function zarf<T>(veri: unknown): SayfaliYanit<T> {
  const z = (veri ?? {}) as Record<string, unknown>;
  const liste = [z.content, z.items, z.products, z.skus].find(Array.isArray) as T[] | undefined;
  const sayi = (k: string) => (typeof z[k] === "number" ? (z[k] as number) : undefined);
  return {
    content: liste ?? [],
    totalPages: sayi("totalPages") ?? sayi("pageCount"),
    totalElements: sayi("totalElements") ?? sayi("totalCount"),
    page: sayi("page") ?? sayi("pageNumber"),
    size: sayi("size") ?? sayi("pageSize"),
  };
}

export function n11Istemcisi(
  { appKey, appSecret }: N11Kimlik,
  { fetchImpl, taban = N11_TABAN }: { fetchImpl?: FetchImpl; taban?: string } = {},
): N11Istemcisi {
  const http = httpIstemci({
    platform: "n11",
    fetchImpl,
    basliklar: {
      appkey: appKey.trim(),
      appsecret: appSecret.trim(),
      Accept: "application/json",
    },
  });

  const siparisUrl = (baslangic: number, bitis: number, sayfa: number, boyut: number) =>
    `${taban}/rest/delivery/v1/shipmentPackages` +
    `?startDate=${baslangic}&endDate=${bitis}&page=${sayfa}&size=${boyut}` +
    // Güncelleme tarihine göre, eskiden yeniye: pencere yarıda kesilse bile
    // boşluk sonda kalır (Trendyol motoruyla aynı ilke).
    `&orderByField=true&orderByDirection=ASC&sender=ALL`;

  return {
    async siparisler({ baslangic, bitis, sayfa }) {
      return zarf<HamSiparis>(await http.jsonAl(siparisUrl(baslangic, bitis, sayfa, SIPARIS_SAYFA_BOYUTU)));
    },

    async urunler({ sayfa }) {
      const url = `${taban}/ms/product-query?page=${sayfa}&size=${URUN_SAYFA_BOYUTU}&sender=SELLER`;
      return zarf<HamUrun>(await http.jsonAl(url));
    },

    /** Son 24 saatten tek kayıt; 429 kimliğin geçerli olduğunu gösterir. */
    async baglantiTest(): Promise<BaglantiTestSonucu> {
      const simdi = Date.now();
      const url = siparisUrl(simdi - 86_400_000, simdi, 0, 1);
      try {
        const yanit = await http.istek(url);
        if (yanit.status === 429) {
          return { ok: true, mesaj: "Bağlantı kuruldu (hız sınırı, kimlik geçerli)." };
        }
        if (yanit.status === 401 || yanit.status === 403) {
          return { ok: false, mesaj: `App Key veya App Secret hatalı (${yanit.status}).` };
        }
        if (!yanit.ok) {
          const govde = await http.govdeOku(yanit);
          return { ok: false, mesaj: `N11 hata verdi (${yanit.status}): ${govde.slice(0, 160)}` };
        }
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
      }
    },
  };
}
