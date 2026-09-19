import {
  PazaryeriBaglantiHatasi,
  PazaryeriHatasi,
  PazaryeriHizSiniri,
  PazaryeriKimlikHatasi,
} from "./hatalar";
import type { Platform } from "./tipler";

/**
 * ORTAK HTTP İSTEMCİSİ — zaman aşımı ve hata sınıflandırması tek yerde.
 *
 * Her sağlayıcı kendi başlığını/URL'sini kurar ama `istek`/`jsonAl` buradan
 * gelir: 429 → `PazaryeriHizSiniri` (Retry-After okunur), 401/403 →
 * `PazaryeriKimlikHatasi`, ağ/zaman aşımı → `PazaryeriBaglantiHatasi`.
 *
 * `fetchImpl` ENJEKTE EDİLEBİLİR: testler gerçek ağa çıkmadan
 * `new Response(JSON, {status})` ile her yolu dener. Trendyol'un eski
 * istemcisi global `fetch`e bağlıydı ve hiç test edilemiyordu.
 */
export type FetchImpl = (girdi: string, init?: RequestInit) => Promise<Response>;

export interface HttpSecenekleri {
  platform: Platform;
  /** Her isteğe eklenen başlıklar (yetki, User-Agent, Accept). */
  basliklar?: Record<string, string>;
  zamanAsimiMs?: number;
  fetchImpl?: FetchImpl;
}

export interface HttpIstemcisi {
  /** Ham yanıt; durum kodunu ÇAĞIRAN yorumlar (bağlantı testi gibi). */
  istek(url: string, init?: RequestInit): Promise<Response>;
  /** JSON gövde; 4xx/5xx sınıflandırılmış hata fırlatır. */
  jsonAl<T = unknown>(url: string, init?: RequestInit): Promise<T>;
  govdeOku(yanit: Response): Promise<string>;
}

/** `Retry-After` saniye ya da HTTP tarihi olabilir; ikisini de çözer. */
export function tekrarSaniyesi(yanit: Response): number | null {
  const ham = yanit.headers.get("retry-after");
  if (!ham) return null;
  const n = Number(ham);
  if (Number.isFinite(n) && n >= 0) return Math.round(n);
  const t = Date.parse(ham);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((t - Date.now()) / 1000));
}

export function httpIstemci({
  platform,
  basliklar = {},
  zamanAsimiMs = 30_000,
  fetchImpl = (g, i) => fetch(g, i),
}: HttpSecenekleri): HttpIstemcisi {
  /**
   * Zaman aşımlı `fetch`. `AbortController` + `setTimeout`; zamanlayıcı her
   * durumda temizlenir (aksi hâlde uzun ömürlü süreçte binlerce zamanlayıcı
   * birikir).
   */
  async function istek(url: string, init: RequestInit = {}): Promise<Response> {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), zamanAsimiMs);
    try {
      return await fetchImpl(url, {
        method: "GET",
        ...init,
        headers: { ...basliklar, ...(init.headers as Record<string, string> | undefined) },
        signal: kontrol.signal,
        cache: "no-store",
      });
    } catch (hata) {
      const mesaj = hata instanceof Error ? hata.message : String(hata);
      throw new PazaryeriBaglantiHatasi(
        platform,
        kontrol.signal.aborted ? `zaman aşımı (${zamanAsimiMs} ms)` : mesaj,
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

  async function jsonAl<T>(url: string, init?: RequestInit): Promise<T> {
    const yanit = await istek(url, init);

    if (yanit.status === 429) {
      throw new PazaryeriHizSiniri(platform, await govdeOku(yanit), tekrarSaniyesi(yanit));
    }
    if (yanit.status === 401 || yanit.status === 403) {
      throw new PazaryeriKimlikHatasi(platform, yanit.status, await govdeOku(yanit));
    }
    if (!yanit.ok) {
      throw new PazaryeriHatasi(platform, yanit.status, await govdeOku(yanit));
    }

    try {
      return (await yanit.json()) as T;
    } catch {
      throw new PazaryeriHatasi(
        platform,
        yanit.status,
        "",
        `${platform} yanıtı okunamadı (geçersiz JSON).`,
      );
    }
  }

  return { istek, jsonAl, govdeOku };
}
