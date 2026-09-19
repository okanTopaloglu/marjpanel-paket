import type { FetchImpl } from "../http";
import { PAZARYERLERI } from "../kayit";
import type { Kimlik } from "../kimlik";
import type { NormalSiparis, PazaryeriSaglayici, Sayfa } from "../tipler";
import { kalemleriNormalle, siparisNormalle } from "./esle";
import { amazonIstemcisi, type AmazonAyarlar } from "./istemci";
import type { LwaUygulama } from "./lwa";

/**
 * AMAZON SAĞLAYICISI. İmleç = `NextToken` (opak). Her sipariş için kalemler
 * AYRI istekle çekilir (0,5/sn) — 100 siparişlik sayfa ~3,5 dk sürer; motor
 * 5 dk sınırında sayfayı yarıda bırakabilir, kalan bir sonraki turda gelir
 * (LastUpdatedAfter çakışma payıyla). Ürün kataloğu v1'de yok.
 */
export function amazonSaglayicisi(
  kimlik: Kimlik,
  {
    ayarlar,
    fetchImpl,
    uygulama,
    kalemArasiMs,
  }: {
    ayarlar?: Record<string, unknown>;
    fetchImpl?: FetchImpl;
    uygulama?: LwaUygulama | null;
    /** Testler için; üretimde istemci varsayılanı (2,1 sn). */
    kalemArasiMs?: number;
  } = {},
): PazaryeriSaglayici {
  const a = (ayarlar ?? {}) as AmazonAyarlar;
  const istemci = amazonIstemcisi(
    { sellerId: kimlik.sellerId ?? "", refreshToken: kimlik.refreshToken ?? "" },
    a,
    { fetchImpl, kalemArasiMs, ...(uygulama === undefined ? {} : { uygulama }) },
  );

  return {
    platform: "amazon",
    yetenekler: PAZARYERLERI.amazon.yetenekler,
    baglantiTest: () => istemci.baglantiTest(),

    async siparisler({ baslangic, bitis, imlec }): Promise<Sayfa<NormalSiparis>> {
      const sayfa = await istemci.siparisler({ baslangic, bitis, nextToken: imlec });
      const kayitlar: NormalSiparis[] = [];
      for (const ham of sayfa.siparisler) {
        const id = String(ham.AmazonOrderId ?? "");
        if (!id) continue;
        const kalemler = kalemleriNormalle(await istemci.kalemler(id));
        const n = siparisNormalle(ham, kalemler);
        if (n) kayitlar.push(n);
      }
      return { kayitlar, sonrakiImlec: sayfa.nextToken, toplamSayfa: null };
    },
  };
}
