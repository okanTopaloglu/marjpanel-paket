import type { FetchImpl } from "../http";
import { PAZARYERLERI } from "../kayit";
import type { Kimlik } from "../kimlik";
import type { NormalSiparis, NormalUrun, PazaryeriSaglayici, Sayfa } from "../tipler";
import { sevkiyatNormalle, urunEsle } from "./esle";
import { SIPARIS_SAYFA_BOYUTU, URUN_SAYFA_BOYUTU, idefixIstemcisi } from "./istemci";

/**
 * İDEFİX SAĞLAYICISI. İmleç 1 TABANLI sayfa numarasıdır ("1", "2"…);
 * `pageCount`e varış ya da dolmamış sayfa bitiştir.
 */
function sayfaNo(imlec: string | null): number {
  const n = Number(imlec ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function idefixSaglayicisi(
  kimlik: Kimlik,
  { fetchImpl }: { ayarlar?: Record<string, unknown>; fetchImpl?: FetchImpl } = {},
): PazaryeriSaglayici {
  const istemci = idefixIstemcisi(
    { vendorId: kimlik.vendorId ?? "", apiKey: kimlik.apiKey ?? "", apiSecret: kimlik.apiSecret ?? "" },
    { fetchImpl },
  );

  return {
    platform: "idefix",
    yetenekler: PAZARYERLERI.idefix.yetenekler,
    baglantiTest: () => istemci.baglantiTest(),

    async siparisler({ baslangic, bitis, imlec }): Promise<Sayfa<NormalSiparis>> {
      const sayfa = sayfaNo(imlec);
      const z = await istemci.sevkiyatlar({ baslangic, bitis, sayfa });
      const son =
        z.items.length < SIPARIS_SAYFA_BOYUTU ||
        (z.pageCount != null && sayfa >= z.pageCount);
      return {
        kayitlar: z.items.map(sevkiyatNormalle).filter((s): s is NormalSiparis => s !== null),
        sonrakiImlec: son ? null : String(sayfa + 1),
        toplamSayfa: z.pageCount ?? null,
        // İlerleme çubuğu 0 tabanlı sayar.
        sayfaNo: sayfa - 1,
      };
    },

    async urunler({ imlec }): Promise<Sayfa<NormalUrun>> {
      const sayfa = sayfaNo(imlec);
      const ham = await istemci.urunler({ sayfa });
      return {
        kayitlar: ham.map(urunEsle).filter((u): u is NormalUrun => u !== null),
        sonrakiImlec: ham.length < URUN_SAYFA_BOYUTU ? null : String(sayfa + 1),
        toplamSayfa: null,
        sayfaNo: sayfa - 1,
      };
    },
  };
}
