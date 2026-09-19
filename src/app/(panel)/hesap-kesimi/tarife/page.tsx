import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { getir as sirketGetir, listeleSayimlarla } from "@/lib/db/repos/sirketler";
import { tarifeler_ } from "@/lib/db/repos/finans";
import { TarifeFormu, TarifeGecmisi } from "./tarife-formu";

export const metadata: Metadata = { title: "Tarife" };
export const dynamic = "force-dynamic";

/**
 * TARİFE — şirket başına kademeli paket ücreti + ek hizmet kalemleri + KDV.
 * Yeni kayıt geçerlilik tarihiyle eklenir; eski kesimler etkilenmez.
 */
export default async function TarifeSayfasi({ searchParams }: { searchParams: Promise<{ sirket?: string }> }) {
  const kapsam = await superKapsamiZorunlu();
  const p = await searchParams;
  const sirketler = await listeleSayimlarla();
  const sirketId = p.sirket && sirketler.some((s) => s.id === p.sirket) ? p.sirket : (sirketler[0]?.id ?? kapsam.sirketId);
  const sirket = await sirketGetir(sirketId);
  if (!sirket) redirect("/hesap-kesimi");
  const gecmis = await tarifeler_(sirketId);

  return (
    <>
      <SayfaBasligi
        baslik={`Tarife · ${sirket.ad}`}
        aciklama="Kademeler aylık paket adedine göre; 'toplam' tipinde adedin düştüğü kademe tüm paketlere, 'dilimli' tipinde her dilim kendi fiyatıyla uygulanır."
        geri={{ href: "/hesap-kesimi", etiket: "Hesap kesimi" }}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <TarifeFormu sirketId={sirketId} sirketler={sirketler.map((s) => ({ id: s.id, ad: s.ad }))} son={gecmis[0] ?? null} />
        <TarifeGecmisi kayitlar={gecmis} />
      </div>
    </>
  );
}
