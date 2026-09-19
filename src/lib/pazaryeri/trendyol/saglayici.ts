import type { FetchImpl } from "../http";
import { PAZARYERLERI } from "../kayit";
import type { Kimlik } from "../kimlik";
import type { NormalSiparis, NormalUrun, PazaryeriSaglayici, Sayfa } from "../tipler";
import { siparisNormalle, urunEsle } from "./esle";
import { SAYFA_BOYUTU, trendyolIstemcisi, type SayfaliYanit } from "./istemci";

/**
 * TRENDYOL SAĞLAYICISI — `PazaryeriSaglayici` sözleşmesinin ilk uygulaması.
 *
 * İmleç = sayfa numarasının metni ("0", "1", …). Son sayfa kuralı eski
 * motordan buraya indi: dolmamış sayfa ya da `totalPages`e varış → `null`.
 * Motor bu kuralı artık bilmez; Amazon'un `NextToken`i de aynı arayüzden geçer.
 *
 * Saat ofseti `ayarlar.saatOfseti`nden, yoksa `TRENDYOL_SIPARIS_SAAT_OFSETI`
 * ortam değişkeninden okunur (mevcut kurulumlar bozulmasın).
 */
function saatOfseti(ayarlar: Record<string, unknown> | undefined): number {
  const a = Number(ayarlar?.saatOfseti);
  if (Number.isFinite(a)) return a;
  const n = Number(process.env.TRENDYOL_SIPARIS_SAAT_OFSETI ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sayfaNo(imlec: string | null): number {
  const n = Number(imlec ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function sonrakiImlec<T>(yanit: SayfaliYanit<T>, sayfa: number): string | null {
  if (yanit.content.length < SAYFA_BOYUTU) return null;
  if (yanit.totalPages != null && sayfa + 1 >= yanit.totalPages) return null;
  return String(sayfa + 1);
}

export function trendyolSaglayicisi(
  kimlik: Kimlik,
  { ayarlar, fetchImpl }: { ayarlar?: Record<string, unknown>; fetchImpl?: FetchImpl } = {},
): PazaryeriSaglayici {
  const istemci = trendyolIstemcisi(
    {
      saticiId: kimlik.saticiId ?? "",
      apiKey: kimlik.apiKey ?? "",
      apiSecret: kimlik.apiSecret ?? "",
    },
    { fetchImpl },
  );
  const ofset = saatOfseti(ayarlar);

  return {
    platform: "trendyol",
    yetenekler: PAZARYERLERI.trendyol.yetenekler,

    baglantiTest: () => istemci.baglantiTest(),

    async siparisler({ baslangic, bitis, imlec }): Promise<Sayfa<NormalSiparis>> {
      const sayfa = sayfaNo(imlec);
      const yanit = await istemci.siparisler({ baslangic, bitis, sayfa });
      return {
        kayitlar: yanit.content
          .map((ham) => siparisNormalle(ham, { saatOfseti: ofset }))
          .filter((s): s is NormalSiparis => s !== null),
        sonrakiImlec: sonrakiImlec(yanit, sayfa),
        toplamSayfa: yanit.totalPages ?? null,
        sayfaNo: sayfa,
      };
    },

    async urunler({ imlec }): Promise<Sayfa<NormalUrun>> {
      const sayfa = sayfaNo(imlec);
      const yanit = await istemci.urunler({ sayfa });
      return {
        kayitlar: yanit.content.map(urunEsle).filter((u): u is NormalUrun => u !== null),
        sonrakiImlec: sonrakiImlec(yanit, sayfa),
        toplamSayfa: yanit.totalPages ?? null,
        sayfaNo: sayfa,
      };
    },
  };
}
