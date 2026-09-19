import type { Metadata } from "next";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { listeleSayimlarla } from "@/lib/db/repos/sirketler";
import { donemPaketSayilari, gecerliTarife, kesimler, platformBakiyeleri, tarifeTanimi } from "@/lib/db/repos/finans";
import { donemMi, oncekiDonem } from "@/lib/finans/hesap";
import { HesapKesimiTablosu, type KesimDonemSatiri } from "./hesap-kesimi-tablosu";

export const metadata: Metadata = { title: "Hesap Kesimi" };
export const dynamic = "force-dynamic";

/**
 * HESAP KESİMİ — süper yönetici, dönem (ay) bazında şirket tablosu.
 * Her satır: dönemde okutulan paket, geçerli tarife, kesim durumu/tutarı,
 * bakiye. Eylemler: taslak oluştur/yenile, kes (fatura no + vade), ödeme
 * kaydet, iptal, detay.
 */
export default async function HesapKesimiSayfasi({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  await superKapsamiZorunlu();
  const p = await searchParams;
  const donem = donemMi(p.donem) ? p.donem : oncekiDonem();

  const [sirketler, paketler, kesimListesi, bakiyeler] = await Promise.all([
    listeleSayimlarla(),
    donemPaketSayilari(donem),
    kesimler(undefined, donem),
    platformBakiyeleri(),
  ]);
  const tarifeler = await Promise.all(sirketler.map((s) => gecerliTarife(s.id, `${donem}-01`)));

  const satirlar: KesimDonemSatiri[] = sirketler.map((s, i) => {
    const t = tarifeler[i] ?? null;
    const b = bakiyeler.find((x) => x.sirketId === s.id);
    return {
      sirketId: s.id,
      sirketAd: s.ad,
      paketSayisi: paketler.get(s.id) ?? 0,
      tarife: t ? tarifeTanimi(t) : null,
      kesim: kesimListesi.find((k) => k.sirketId === s.id) ?? null,
      bakiye: b?.bakiye ?? "0.00",
      gecikmis: b?.gecikmis ?? 0,
    };
  });

  return (
    <>
      <SayfaBasligi
        baslik="Hesap Kesimi"
        aciklama="Ay sonunda her şirket için paket sayısı × tarife + ek hizmetler. Taslağı gözden geçirip fatura numarasıyla kesin; ödemeleri buradan kaydedin."
      />
      <HesapKesimiTablosu donem={donem} satirlar={satirlar} />
    </>
  );
}
