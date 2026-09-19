import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { KesimDokumu } from "@/components/finans/kesim-dokumu";
import { YazdirButonu } from "@/components/finans/yazdir-butonu";
import { kesimGetir } from "@/lib/db/repos/finans";
import { donemAdi } from "@/lib/finans/hesap";

export const metadata: Metadata = { title: "Hesap kesimi dökümü" };
export const dynamic = "force-dynamic";

export default async function KesimDetaySayfasi({ params }: { params: Promise<{ id: string }> }) {
  await superKapsamiZorunlu();
  const { id } = await params;
  const kesim = await kesimGetir(id);
  if (!kesim) notFound();
  return (
    <>
      <SayfaBasligi
        baslik={`${kesim.sirketAd} · ${donemAdi(kesim.donem)}`}
        aciklama={`${kesim.paketSayisi} paket · ${kesim.kaydedenAd}${kesim.not ? ` · ${kesim.not}` : ""}`}
        geri={{ href: "/hesap-kesimi", etiket: "Hesap kesimi" }}
        aksiyonlar={<YazdirButonu />}
      />
      <KesimDokumu kesim={kesim} />
    </>
  );
}
