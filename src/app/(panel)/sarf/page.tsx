import type { Metadata } from "next";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { hareketler, listele } from "@/lib/db/repos/sarf";
import { SarfEkleTetikleyici } from "./sarf-formu";
import { SarfListesi } from "./sarf-listesi";

export const metadata: Metadata = { title: "Sarf Malzemeleri" };
export const dynamic = "force-dynamic";

/**
 * SARF MALZEMELERİ — koli, patpat, bant, poşet. Tüketim paket başı normdan
 * türetilir; alım ve sayım girilir. Yalnız süper yönetici.
 */
export default async function SarfSayfasi({ searchParams }: { searchParams: Promise<{ sec?: string }> }) {
  await superKapsamiZorunlu();
  const { sec } = await searchParams;
  const liste = await listele();
  const secili = sec && liste.some((s) => s.id === sec) ? sec : null;
  const hareketListesi = secili ? await hareketler(secili) : [];

  return (
    <>
      <SayfaBasligi
        baslik="Sarf Malzemeleri"
        aciklama="Paketlemede tüketilen malzemeler. Tüketim, paket başına tanımladığınız normdan otomatik düşer; alım ve sayım girerek gerçekle hizalayın."
        aksiyonlar={<SarfEkleTetikleyici />}
      />
      <SarfListesi liste={liste} secili={secili} hareketler={hareketListesi} />
    </>
  );
}
