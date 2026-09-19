import { httpIstemci, type FetchImpl } from "../http";
import type { BaglantiTestSonucu } from "../tipler";

/**
 * HEPSİBURADA OMS / MPOP İSTEMCİSİ — yalnız sunucu. Belge: docs/pazaryeri/hepsiburada.md.
 *
 * ÜÇ KİMLİK PARÇASI, ÜÇÜ DE 401 SEBEBİ:
 *  · Basic auth kullanıcı adı = merchantId (GUID), şifre = servis anahtarı.
 *  · `User-Agent` = panelde kayıtlı entegratör adı, BİREBİR. Süslenmiş her
 *    varyant ("{id} - {ad}") reddedilir; Trendyol'un tersine burada sabit
 *    bir sözleşme yok, değer kullanıcıdan gelir.
 *
 * `/packages` listesi ZARFSIZ düz dizi döner ve `limit` en fazla 10'dur;
 * `Offset` büyük O ile yazılır (spec böyle). Tarih `yyyy-MM-dd HH:mm`,
 * Türkiye saati — ISO gönderen "200 ama yanlış pencere" alıyor.
 */
export const HB_OMS_TABAN =
  process.env.HEPSIBURADA_OMS_BASE?.trim() || "https://oms-external.hepsiburada.com";
export const HB_OMS_SIT = "https://oms-external-sit.hepsiburada.com";
export const HB_MPOP_TABAN =
  process.env.HEPSIBURADA_MPOP_BASE?.trim() || "https://mpop.hepsiburada.com/product";
export const HB_MPOP_SIT = "https://mpop-sit.hepsiburada.com/product";

/** `/packages` azami 10; katalog için belge sınır vermiyor. */
export const PAKET_SAYFA_BOYUTU = 10;
export const URUN_SAYFA_BOYUTU = 200;

export type HamPaket = Record<string, unknown>;
export type HamUrun = Record<string, unknown>;

export interface HbKimlik {
  merchantId: string;
  serviceKey: string;
  entegratorAdi: string;
}

export interface UrunZarfi {
  data: HamUrun[];
  totalPages?: number;
  totalElements?: number;
  number?: number;
  last?: boolean;
}

export interface HbIstemcisi {
  paketler(p: { baslangic: number; bitis: number; offset: number }): Promise<HamPaket[]>;
  urunler(p: { sayfa: number }): Promise<UrunZarfi>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

/** Epoch ms → "yyyy-MM-dd HH:mm" Europe/Istanbul. */
export function hbTarih(ms: number): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const al = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${al("year")}-${al("month")}-${al("day")} ${al("hour")}:${al("minute")}`;
}

export function hbIstemcisi(
  { merchantId, serviceKey, entegratorAdi }: HbKimlik,
  {
    fetchImpl,
    sandbox = false,
  }: { fetchImpl?: FetchImpl; sandbox?: boolean } = {},
): HbIstemcisi {
  const oms = sandbox ? HB_OMS_SIT : HB_OMS_TABAN;
  const mpop = sandbox ? HB_MPOP_SIT : HB_MPOP_TABAN;
  const id = encodeURIComponent(merchantId.trim());
  const yetki = Buffer.from(`${merchantId.trim()}:${serviceKey.trim()}`).toString("base64");
  const http = httpIstemci({
    platform: "hepsiburada",
    fetchImpl,
    basliklar: {
      Authorization: `Basic ${yetki}`,
      "User-Agent": entegratorAdi.trim(),
      Accept: "application/json",
    },
  });

  const paketUrl = (baslangic: number, bitis: number, offset: number, limit: number) =>
    `${oms}/packages/merchantid/${id}` +
    `?begindate=${encodeURIComponent(hbTarih(baslangic))}&enddate=${encodeURIComponent(hbTarih(bitis))}` +
    `&limit=${limit}&Offset=${offset}`;

  return {
    async paketler({ baslangic, bitis, offset }) {
      const veri = await http.jsonAl<unknown>(paketUrl(baslangic, bitis, offset, PAKET_SAYFA_BOYUTU));
      // Spec düz dizi der; bazı sürümler {items:[...]} zarfı dönebilir.
      if (Array.isArray(veri)) return veri as HamPaket[];
      const z = (veri ?? {}) as Record<string, unknown>;
      const liste = [z.items, z.packages, z.data].find(Array.isArray) as HamPaket[] | undefined;
      return liste ?? [];
    },

    async urunler({ sayfa }) {
      const url = `${mpop}/api/products/all-products-of-merchant/${id}?page=${sayfa}&size=${URUN_SAYFA_BOYUTU}`;
      const z = (await http.jsonAl<Record<string, unknown>>(url)) ?? {};
      const sayi = (k: string) => (typeof z[k] === "number" ? (z[k] as number) : undefined);
      return {
        data: Array.isArray(z.data) ? (z.data as HamUrun[]) : [],
        totalPages: sayi("totalPages"),
        totalElements: sayi("totalElements"),
        number: sayi("number"),
        last: typeof z.last === "boolean" ? z.last : undefined,
      };
    },

    /** Son 24 saatin ilk paketi; 429 kimliğin geçerli olduğunu gösterir. */
    async baglantiTest(): Promise<BaglantiTestSonucu> {
      const simdi = Date.now();
      try {
        const yanit = await http.istek(paketUrl(simdi - 86_400_000, simdi, 0, 1));
        if (yanit.status === 429) {
          return { ok: true, mesaj: "Bağlantı kuruldu (hız sınırı, kimlik geçerli)." };
        }
        if (yanit.status === 401 || yanit.status === 403) {
          return {
            ok: false,
            mesaj:
              `Yetki reddedildi (${yanit.status}). Merchant ID, servis anahtarı ve ` +
              `entegratör adının (User-Agent) panelde kayıtlı olanla birebir aynı olduğunu kontrol edin.`,
          };
        }
        if (!yanit.ok) {
          const govde = await http.govdeOku(yanit);
          return { ok: false, mesaj: `Hepsiburada hata verdi (${yanit.status}): ${govde.slice(0, 160)}` };
        }
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
      }
    },
  };
}
