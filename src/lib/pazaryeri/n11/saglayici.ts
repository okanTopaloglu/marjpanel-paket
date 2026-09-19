import type { FetchImpl } from "../http";
import { PAZARYERLERI } from "../kayit";
import type { Kimlik } from "../kimlik";
import type { NormalSiparis, NormalUrun, PazaryeriSaglayici, Sayfa } from "../tipler";
import { siparisNormalle, urunEsle } from "./esle";
import {
  SIPARIS_SAYFA_BOYUTU,
  URUN_SAYFA_BOYUTU,
  n11Istemcisi,
  type SayfaliYanit,
} from "./istemci";

/**
 * N11 SAĞLAYICISI. İmleç = sayfa numarasının metni; son sayfa kuralı
 * Trendyol'la aynı (dolmamış sayfa ya da `totalPages`e varış). Ürün ucunda
 * `totalPages` gelmezse boş sayfa bitiş sayılır (portal notu).
 */
function sayfaNo(imlec: string | null): number {
  const n = Number(imlec ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function sonrakiImlec<T>(yanit: SayfaliYanit<T>, sayfa: number, boyut: number): string | null {
  if (yanit.content.length === 0) return null;
  if (yanit.content.length < boyut) return null;
  if (yanit.totalPages != null && sayfa + 1 >= yanit.totalPages) return null;
  return String(sayfa + 1);
}

export function n11Saglayicisi(
  kimlik: Kimlik,
  { fetchImpl }: { ayarlar?: Record<string, unknown>; fetchImpl?: FetchImpl } = {},
): PazaryeriSaglayici {
  const istemci = n11Istemcisi(
    { appKey: kimlik.appKey ?? "", appSecret: kimlik.appSecret ?? "" },
    { fetchImpl },
  );

  return {
    platform: "n11",
    yetenekler: PAZARYERLERI.n11.yetenekler,
    baglantiTest: () => istemci.baglantiTest(),

    async siparisler({ baslangic, bitis, imlec }): Promise<Sayfa<NormalSiparis>> {
      const sayfa = sayfaNo(imlec);
      const yanit = await istemci.siparisler({ baslangic, bitis, sayfa });
      return {
        kayitlar: yanit.content.map(siparisNormalle).filter((s): s is NormalSiparis => s !== null),
        sonrakiImlec: sonrakiImlec(yanit, sayfa, SIPARIS_SAYFA_BOYUTU),
        toplamSayfa: yanit.totalPages ?? null,
        sayfaNo: sayfa,
      };
    },

    async urunler({ imlec }): Promise<Sayfa<NormalUrun>> {
      const sayfa = sayfaNo(imlec);
      const yanit = await istemci.urunler({ sayfa });
      return {
        kayitlar: yanit.content.map(urunEsle).filter((u): u is NormalUrun => u !== null),
        sonrakiImlec: sonrakiImlec(yanit, sayfa, URUN_SAYFA_BOYUTU),
        toplamSayfa: yanit.totalPages ?? null,
        sayfaNo: sayfa,
      };
    },
  };
}
