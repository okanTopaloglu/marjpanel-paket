/**
 * TRENDYOL API İSTEMCİSİ — yalnız sunucu.
 *
 * PartnerSys'te her çağrı kendi `fetch`ini, kendi başlığını ve kendi hata
 * metnini kuruyordu (sipariş senkronu, ürün senkronu, bağlantı testi üç ayrı
 * kopya). Burada tek istemci var: başlıklar, zaman aşımı ve HATA SINIFLARI tek
 * yerde. Çağıran hata TÜRÜNE bakarak karar verir (429'da o entegrasyonu bırak,
 * 401'de kullanıcıya "anahtar hatalı" de) — metin ayrıştırmaz.
 */

export const TRENDYOL_TABAN =
  process.env.TRENDYOL_API_BASE?.trim() || "https://apigw.trendyol.com";

/** İstek zaman aşımı (ms). Trendyol yanıt vermediğinde iş askıda kalmaz. */
const ZAMAN_ASIMI_MS = 30_000;

/** Sayfa boyutu — Trendyol'un izin verdiği azami değer. */
export const SAYFA_BOYUTU = 200;

export class TrendyolHatasi extends Error {
  constructor(
    readonly durumKodu: number,
    readonly govde: string,
    mesaj?: string,
  ) {
    super(mesaj ?? `Trendyol API ${durumKodu}: ${govde.slice(0, 200)}`);
    this.name = "TrendyolHatasi";
  }
}

/** 429 — hız sınırı. Çağıran BU entegrasyonu bırakır, diğerlerine devam eder. */
export class TrendyolHizSiniri extends TrendyolHatasi {
  constructor(govde = "") {
    super(429, govde, "Trendyol hız sınırı (429). Bir süre sonra tekrar denenecek.");
    this.name = "TrendyolHizSiniri";
  }
}

/** 401/403 — anahtar/satıcı kimliği hatalı. Tekrar denemek işe yaramaz. */
export class TrendyolKimlikHatasi extends TrendyolHatasi {
  constructor(durumKodu: number, govde = "") {
    super(
      durumKodu,
      govde,
      `API anahtarı veya gizli anahtar hatalı (${durumKodu}). Entegrasyon bilgilerini kontrol edin.`,
    );
    this.name = "TrendyolKimlikHatasi";
  }
}

/** Ağ/zaman aşımı — istek hiç tamamlanamadı. */
export class TrendyolBaglantiHatasi extends Error {
  constructor(mesaj: string) {
    super(`Trendyol bağlantı hatası: ${mesaj}`);
    this.name = "TrendyolBaglantiHatasi";
  }
}

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

export interface BaglantiTestSonucu {
  ok: boolean;
  mesaj: string;
}

export interface TrendyolIstemcisi {
  siparisler(p: SiparisParametreleri): Promise<SayfaliYanit<HamSiparis>>;
  urunler(p: UrunParametreleri): Promise<SayfaliYanit<HamUrun>>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

export function trendyolIstemcisi({
  saticiId,
  apiKey,
  apiSecret,
}: TrendyolKimlik): TrendyolIstemcisi {
  const yetki = Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString(
    "base64",
  );
  const basliklar: Record<string, string> = {
    Authorization: `Basic ${yetki}`,
    // Trendyol self-integration sözleşmesi: satıcı kimliği User-Agent'ta.
    "User-Agent": `${saticiId} - SelfIntegration`,
    Accept: "application/json",
  };

  /**
   * Zaman aşımlı `fetch`. `AbortController` + `setTimeout`; zamanlayıcı her
   * durumda temizlenir (aksi hâlde uzun ömürlü süreçte binlerce zamanlayıcı
   * birikir).
   */
  async function istek(url: string): Promise<Response> {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      return await fetch(url, {
        method: "GET",
        headers: basliklar,
        signal: kontrol.signal,
        cache: "no-store",
      });
    } catch (hata) {
      const mesaj = hata instanceof Error ? hata.message : String(hata);
      throw new TrendyolBaglantiHatasi(
        kontrol.signal.aborted ? `zaman aşımı (${ZAMAN_ASIMI_MS} ms)` : mesaj,
      );
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  async function govdeOku(yanit: Response): Promise<string> {
    try {
      return await yanit.text();
    } catch {
      return "";
    }
  }

  async function jsonAl<T>(url: string): Promise<SayfaliYanit<T>> {
    const yanit = await istek(url);

    if (yanit.status === 429) throw new TrendyolHizSiniri(await govdeOku(yanit));
    if (yanit.status === 401 || yanit.status === 403) {
      throw new TrendyolKimlikHatasi(yanit.status, await govdeOku(yanit));
    }
    if (!yanit.ok) {
      throw new TrendyolHatasi(yanit.status, await govdeOku(yanit));
    }

    let veri: unknown;
    try {
      veri = await yanit.json();
    } catch {
      throw new TrendyolHatasi(yanit.status, "", "Trendyol yanıtı okunamadı (geçersiz JSON).");
    }

    const z = (veri ?? {}) as Record<string, unknown>;
    return {
      content: Array.isArray(z.content) ? (z.content as T[]) : [],
      totalPages: typeof z.totalPages === "number" ? z.totalPages : undefined,
      totalElements:
        typeof z.totalElements === "number" ? z.totalElements : undefined,
      page: typeof z.page === "number" ? z.page : undefined,
      size: typeof z.size === "number" ? z.size : undefined,
    };
  }

  return {
    siparisler({ baslangic, bitis, sayfa }) {
      const url =
        `${TRENDYOL_TABAN}/integration/order/sellers/${saticiId}/orders` +
        `?startDate=${baslangic}&endDate=${bitis}&size=${SAYFA_BOYUTU}&page=${sayfa}` +
        `&orderByField=CreatedDate&orderByDirection=DESC`;
      return jsonAl<HamSiparis>(url);
    },

    urunler({ sayfa, onayli = true }) {
      const url =
        `${TRENDYOL_TABAN}/integration/product/sellers/${saticiId}/products` +
        `?page=${sayfa}&size=${SAYFA_BOYUTU}&approved=${onayli}`;
      return jsonAl<HamUrun>(url);
    },

    /**
     * Bağlantı testi tek kayıt ister. 429 BAŞARIDIR: hız sınırına takılmak
     * kimliğin DOĞRULANDIĞI anlamına gelir (yanlış anahtar 401 alırdı).
     */
    async baglantiTest(): Promise<BaglantiTestSonucu> {
      const url = `${TRENDYOL_TABAN}/integration/order/sellers/${saticiId}/orders?size=1`;
      try {
        const yanit = await istek(url);
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
          const govde = await govdeOku(yanit);
          return { ok: false, mesaj: `Trendyol hata verdi (${yanit.status}): ${govde.slice(0, 160)}` };
        }
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        const mesaj = hata instanceof Error ? hata.message : String(hata);
        return { ok: false, mesaj };
      }
    },
  };
}
