import { httpIstemci, type FetchImpl } from "../http";
import type { BaglantiTestSonucu } from "../tipler";

/**
 * İDEFİX MERCHANT API İSTEMCİSİ — yalnız sunucu. Belge: docs/pazaryeri/idefix.md.
 *
 * Kimlik tek başlıktır: `X-API-KEY: base64(apiKey:apiSecret)` ("vendor
 * token"). Vendor ID URL yolunda. Tarihler `yyyy/MM/dd HH:mm:ss`, Türkiye
 * saati; sayfa 1 TABANLI (Trendyol/N11'in 0 tabanlısından farklı).
 */
export const IDEFIX_TABAN = process.env.IDEFIX_API_BASE?.trim() || "https://merchantapi.idefix.com";

/** Belge üst sınır vermiyor (varsayılan 10); 50 ölçülü bir seçim. */
export const SIPARIS_SAYFA_BOYUTU = 50;
export const URUN_SAYFA_BOYUTU = 100;

export type HamSevkiyat = Record<string, unknown>;
export type HamUrun = Record<string, unknown>;

export interface IdefixKimlik {
  vendorId: string;
  apiKey: string;
  apiSecret: string;
}

export interface SevkiyatZarfi {
  items: HamSevkiyat[];
  totalCount?: number;
  pageCount?: number;
  currentPage?: number;
}

export interface IdefixIstemcisi {
  sevkiyatlar(p: { baslangic: number; bitis: number; sayfa: number }): Promise<SevkiyatZarfi>;
  urunler(p: { sayfa: number }): Promise<HamUrun[]>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

/** Epoch ms → "yyyy/MM/dd HH:mm:ss" Europe/Istanbul. */
export function idefixTarih(ms: number): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const al = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${al("year")}/${al("month")}/${al("day")} ${al("hour")}:${al("minute")}:${al("second")}`;
}

export function idefixIstemcisi(
  { vendorId, apiKey, apiSecret }: IdefixKimlik,
  { fetchImpl, taban = IDEFIX_TABAN }: { fetchImpl?: FetchImpl; taban?: string } = {},
): IdefixIstemcisi {
  const id = encodeURIComponent(vendorId.trim());
  const jeton = Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString("base64");
  const http = httpIstemci({
    platform: "idefix",
    fetchImpl,
    basliklar: { "X-API-KEY": jeton, Accept: "application/json" },
  });

  const sevkiyatUrl = (baslangic: number, bitis: number, sayfa: number, limit: number) =>
    `${taban}/oms/${id}/list` +
    `?startDate=${encodeURIComponent(idefixTarih(baslangic))}&endDate=${encodeURIComponent(idefixTarih(bitis))}` +
    `&page=${sayfa}&limit=${limit}&sortByField=updatedAt&sortDirection=asc`;

  const sayi = (z: Record<string, unknown>, k: string) =>
    typeof z[k] === "number" ? (z[k] as number) : undefined;

  return {
    async sevkiyatlar({ baslangic, bitis, sayfa }) {
      const z = (await http.jsonAl<Record<string, unknown>>(sevkiyatUrl(baslangic, bitis, sayfa, SIPARIS_SAYFA_BOYUTU))) ?? {};
      return {
        items: Array.isArray(z.items) ? (z.items as HamSevkiyat[]) : [],
        totalCount: sayi(z, "totalCount"),
        pageCount: sayi(z, "pageCount"),
        currentPage: sayi(z, "currentPage"),
      };
    },

    async urunler({ sayfa }) {
      const url = `${taban}/pim/pool/${id}/list?page=${sayfa}&limit=${URUN_SAYFA_BOYUTU}`;
      const veri = await http.jsonAl<unknown>(url);
      if (Array.isArray(veri)) return veri as HamUrun[];
      const z = (veri ?? {}) as Record<string, unknown>;
      const liste = [z.products, z.items, z.data].find(Array.isArray) as HamUrun[] | undefined;
      return liste ?? [];
    },

    async baglantiTest(): Promise<BaglantiTestSonucu> {
      const simdi = Date.now();
      try {
        const yanit = await http.istek(sevkiyatUrl(simdi - 86_400_000, simdi, 1, 1));
        if (yanit.status === 429) {
          return { ok: true, mesaj: "Bağlantı kuruldu (hız sınırı, kimlik geçerli)." };
        }
        if (yanit.status === 401 || yanit.status === 403) {
          return { ok: false, mesaj: `API anahtarı/gizli anahtar reddedildi (${yanit.status}).` };
        }
        if (yanit.status === 404) {
          return { ok: false, mesaj: "Vendor ID bulunamadı. Satıcı kimliğini kontrol edin." };
        }
        if (!yanit.ok) {
          const govde = await http.govdeOku(yanit);
          return { ok: false, mesaj: `idefix hata verdi (${yanit.status}): ${govde.slice(0, 160)}` };
        }
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
      }
    },
  };
}
