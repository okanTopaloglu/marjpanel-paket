import type { Metadata } from "next";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { SAYFA_LIMITI, listele } from "@/lib/db/repos/mal-kabul";
import { listeleSayimlarla } from "@/lib/db/repos/sirketler";
import { MalKabulEkleTetikleyici } from "./mal-kabul-formu";
import { MalKabulListesi } from "./mal-kabul-listesi";

export const metadata: Metadata = { title: "Mal Kabul" };
export const dynamic = "force-dynamic";

function sayfaNo(ham: string | undefined): number {
  const n = Number(ham);
  return Number.isInteger(n) && n > 1 ? n - 1 : 0;
}

/**
 * MAL KABUL — kiracıların depoya yolladığı mal. Yalnız süper yönetici (depo
 * MarjPanel'indir). Fiş = şirket + tür + kalemler; stok raporu buradan beslenir.
 */
export default async function MalKabulSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sirket?: string; sayfa?: string }>;
}) {
  await superKapsamiZorunlu();
  const p = await searchParams;
  const sirketId = p.sirket?.trim() || undefined;
  const sayfa = sayfaNo(p.sayfa);

  const [{ satirlar, toplam }, sirketler] = await Promise.all([
    listele({ sirketId, sayfa, limit: SAYFA_LIMITI }),
    listeleSayimlarla(),
  ]);
  const secenekler = sirketler.map((s) => ({ id: s.id, ad: s.ad }));

  return (
    <>
      <SayfaBasligi
        baslik="Mal Kabul"
        aciklama="Şirketlerin depoya yolladığı ürünler; her fiş stoğu artırır, iade ve düzeltme fişleri eksiltir."
        aksiyonlar={<MalKabulEkleTetikleyici sirketler={secenekler} />}
      />
      <MalKabulListesi
        satirlar={satirlar}
        toplam={toplam}
        sayfa={sayfa}
        limit={SAYFA_LIMITI}
        sirketler={secenekler}
        seciliSirket={sirketId ?? ""}
      />
    </>
  );
}
