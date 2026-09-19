import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { KesimDokumu } from "@/components/finans/kesim-dokumu";
import { YazdirButonu } from "@/components/finans/yazdir-butonu";
import { kesimGetir } from "@/lib/db/repos/finans";
import { donemAdi } from "@/lib/finans/hesap";

export const metadata: Metadata = { title: "Hesap dökümü" };
export const dynamic = "force-dynamic";

export default async function HesabimDetaySayfasi({ params }: { params: Promise<{ id: string }> }) {
  const kapsam = await adminKapsamiZorunlu();
  const { id } = await params;
  // Kiracı yalnız KENDİ kesimini görür: sirketId kapsamdan, URL'den değil.
  const kesim = await kesimGetir(id, kapsam.sirketId);
  if (!kesim) notFound();
  return (
    <>
      <SayfaBasligi
        baslik={donemAdi(kesim.donem)}
        aciklama={`${kesim.paketSayisi} paket hazırlandı`}
        geri={{ href: "/hesabim", etiket: "Hesabım" }}
        aksiyonlar={<YazdirButonu />}
      />
      <KesimDokumu kesim={kesim} />
    </>
  );
}
