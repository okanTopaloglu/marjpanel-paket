import type { Metadata } from "next";
import { AlertTriangle, Boxes, MinusCircle, PauseCircle } from "lucide-react";
import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { StatKarti } from "@/components/panel/stat-karti";
import { SAYFA_LIMITI, stokOzeti, stokRaporu } from "@/lib/db/repos/stok";
import { listeleSayimlarla } from "@/lib/db/repos/sirketler";
import { sayi } from "@/lib/format/sayi";
import { StokTablosu } from "./stok-tablosu";

export const metadata: Metadata = { title: "Stok" };
export const dynamic = "force-dynamic";

function sayfaNo(ham: string | undefined): number {
  const n = Number(ham);
  return Number.isInteger(n) && n > 1 ? n - 1 : 0;
}

/**
 * STOK — barkod bazında giren / çıkan / kalan.
 *
 * Süper yönetici şirket seçer; şirket yöneticisi yalnız kendi şirketini görür
 * (`?sirket=` parametresi onun için okunmaz — kiracı izolasyonu URL'den
 * delinmez). Sayılar `repos/stok` içinde tek SQL'den gelir.
 */
export default async function StokSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sirket?: string; arama?: string; sayfa?: string }>;
}) {
  const kapsam = await adminKapsamiZorunlu();
  const p = await searchParams;
  const superMi = kapsam.rol === "super_admin";

  const sirketler = superMi ? (await listeleSayimlarla()).map((s) => ({ id: s.id, ad: s.ad })) : [];
  const sirketId = superMi && p.sirket?.trim() && sirketler.some((s) => s.id === p.sirket) ? p.sirket!.trim() : kapsam.sirketId;
  const arama = (p.arama ?? "").trim().slice(0, 120);
  const sayfa = sayfaNo(p.sayfa);

  const [ozet, { satirlar, toplam }] = await Promise.all([
    stokOzeti(sirketId),
    stokRaporu(sirketId, { arama, sayfa, limit: SAYFA_LIMITI }),
  ]);

  return (
    <>
      <SayfaBasligi
        baslik={superMi ? "Stoklar" : "Stokum"}
        aciklama="Depoya kabul edilen mal eksi okutulan paketlerin içeriği. Kritik satırlar 7 gün içinde biter."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKarti etiket="Ürün çeşidi" deger={sayi(ozet.cesit)} dipnot={`${sayi(ozet.toplamKalan)} adet depoda`} ikon={Boxes} />
        <StatKarti etiket="Kritik" deger={sayi(ozet.kritik)} dipnot="5 adetten az ya da 7 günden önce biter" ikon={AlertTriangle} />
        <StatKarti etiket="Eksi stok" deger={sayi(ozet.eksi)} dipnot="Kabulden fazla çıkmış; sayım gerekli" ikon={MinusCircle} />
        <StatKarti etiket="Hareketsiz" deger={sayi(ozet.hareketsiz)} dipnot="30 gündür çıkış yok" ikon={PauseCircle} />
      </div>

      <StokTablosu
        satirlar={satirlar}
        toplam={toplam}
        sayfa={sayfa}
        limit={SAYFA_LIMITI}
        arama={arama}
        sirketler={sirketler}
        seciliSirket={superMi ? sirketId : ""}
      />
    </>
  );
}
