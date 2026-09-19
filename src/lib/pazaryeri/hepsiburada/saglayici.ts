import type { FetchImpl } from "../http";
import { PAZARYERLERI } from "../kayit";
import type { Kimlik } from "../kimlik";
import type { NormalSiparis, NormalUrun, PazaryeriSaglayici, Sayfa } from "../tipler";
import { paketNormalle, urunEsle } from "./esle";
import { PAKET_SAYFA_BOYUTU, URUN_SAYFA_BOYUTU, hbIstemcisi } from "./istemci";

/**
 * HEPSİBURADA SAĞLAYICISI.
 *
 * Sipariş imleci OFFSET'tir ("0", "10", "20"…): `/packages` zarfsız dizi
 * döner, toplam sayı vermez; dolmamış sayfa son sayfadır. Sayfa 10 kayıtla
 * sınırlı olduğundan pencere 3 gün tutulur (kayit.ts) — motorun 100 sayfa
 * emniyeti pencere başına 1000 paket eder.
 *
 * Ürün imleci sayfa numarasıdır; zarf `last`/`totalPages` verir.
 */
export function hepsiburadaSaglayicisi(
  kimlik: Kimlik,
  { ayarlar, fetchImpl }: { ayarlar?: Record<string, unknown>; fetchImpl?: FetchImpl } = {},
): PazaryeriSaglayici {
  const istemci = hbIstemcisi(
    {
      merchantId: kimlik.merchantId ?? "",
      serviceKey: kimlik.serviceKey ?? "",
      entegratorAdi: kimlik.entegratorAdi ?? "",
    },
    { fetchImpl, sandbox: ayarlar?.sandbox === true },
  );

  return {
    platform: "hepsiburada",
    yetenekler: PAZARYERLERI.hepsiburada.yetenekler,
    baglantiTest: () => istemci.baglantiTest(),

    async siparisler({ baslangic, bitis, imlec }): Promise<Sayfa<NormalSiparis>> {
      const offset = Math.max(0, Number(imlec ?? 0) || 0);
      const ham = await istemci.paketler({ baslangic, bitis, offset });
      return {
        kayitlar: ham.map(paketNormalle).filter((s): s is NormalSiparis => s !== null),
        sonrakiImlec: ham.length < PAKET_SAYFA_BOYUTU ? null : String(offset + PAKET_SAYFA_BOYUTU),
        toplamSayfa: null,
        sayfaNo: Math.floor(offset / PAKET_SAYFA_BOYUTU),
      };
    },

    async urunler({ imlec }): Promise<Sayfa<NormalUrun>> {
      const sayfa = Math.max(0, Number(imlec ?? 0) || 0);
      const z = await istemci.urunler({ sayfa });
      const son =
        z.last === true ||
        z.data.length === 0 ||
        z.data.length < URUN_SAYFA_BOYUTU ||
        (z.totalPages != null && sayfa + 1 >= z.totalPages);
      return {
        kayitlar: z.data.map(urunEsle).filter((u): u is NormalUrun => u !== null),
        sonrakiImlec: son ? null : String(sayfa + 1),
        toplamSayfa: z.totalPages ?? null,
        sayfaNo: sayfa,
      };
    },
  };
}
