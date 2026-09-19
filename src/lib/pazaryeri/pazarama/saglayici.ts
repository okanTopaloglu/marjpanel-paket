import type { FetchImpl } from "../http";
import { PAZARYERLERI } from "../kayit";
import type { Kimlik } from "../kimlik";
import type { NormalSiparis, NormalUrun, PazaryeriSaglayici, Sayfa } from "../tipler";
import { siparisNormalle, urunEsle } from "./esle";
import { SIPARIS_SAYFA_BOYUTU, URUN_SAYFA_BOYUTU, pazaramaIstemcisi, type Zarf } from "./istemci";

/** PAZARAMA SAĞLAYICISI. İmleç 1 TABANLI sayfa numarası. */
function sayfaNo(imlec: string | null): number {
  const n = Number(imlec ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function sonrakiImlec<T>(z: Zarf<T>, sayfa: number, boyut: number): string | null {
  if (z.liste.length < boyut) return null;
  if (z.toplamSayfa != null && sayfa >= z.toplamSayfa) return null;
  return String(sayfa + 1);
}

export function pazaramaSaglayicisi(
  kimlik: Kimlik,
  { fetchImpl }: { ayarlar?: Record<string, unknown>; fetchImpl?: FetchImpl } = {},
): PazaryeriSaglayici {
  const istemci = pazaramaIstemcisi(
    { clientId: kimlik.clientId ?? "", clientSecret: kimlik.clientSecret ?? "" },
    { fetchImpl },
  );

  return {
    platform: "pazarama",
    yetenekler: PAZARYERLERI.pazarama.yetenekler,
    baglantiTest: () => istemci.baglantiTest(),

    async siparisler({ baslangic, bitis, imlec }): Promise<Sayfa<NormalSiparis>> {
      const sayfa = sayfaNo(imlec);
      const z = await istemci.siparisler({ baslangic, bitis, sayfa });
      return {
        kayitlar: z.liste.map(siparisNormalle).filter((s): s is NormalSiparis => s !== null),
        sonrakiImlec: sonrakiImlec(z, sayfa, SIPARIS_SAYFA_BOYUTU),
        toplamSayfa: z.toplamSayfa ?? null,
        sayfaNo: sayfa - 1,
      };
    },

    async urunler({ imlec }): Promise<Sayfa<NormalUrun>> {
      const sayfa = sayfaNo(imlec);
      const z = await istemci.urunler({ sayfa });
      return {
        kayitlar: z.liste.map(urunEsle).filter((u): u is NormalUrun => u !== null),
        sonrakiImlec: sonrakiImlec(z, sayfa, URUN_SAYFA_BOYUTU),
        toplamSayfa: z.toplamSayfa ?? null,
        sayfaNo: sayfa - 1,
      };
    },
  };
}
