import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Coins, Package, TrendingUp, Wallet } from "lucide-react";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { StatKarti } from "@/components/panel/stat-karti";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { genelPano } from "@/lib/db/repos/pano";
import { donemAdi, donemMi } from "@/lib/finans/hesap";
import { gunAnahtari } from "@/lib/format/tarih";
import { ondalik, para, sayi } from "@/lib/format/sayi";
import { DonemSecici } from "./donem-secici";
import { IsiHaritasi } from "./isi-haritasi";

export const metadata: Metadata = { title: "Genel Pano" };
export const dynamic = "force-dynamic";

/**
 * GENEL PANO — süper yönetici, platform geneli. Gelir TAHMİNİDİR (dönem
 * paketi × geçerli tarife; gerçek tutar hesap kesiminde belirlenir), sarf
 * gideri normdan türetilir; kâr ikisinin farkı.
 */
export default async function PanoSayfasi({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  await superKapsamiZorunlu();
  const p = await searchParams;
  const donem = donemMi(p.donem) ? p.donem : gunAnahtari().slice(0, 7);
  const pano = await genelPano(donem);

  return (
    <>
      <SayfaBasligi
        baslik="Genel Pano"
        aciklama="Tüm şirketler için iş hacmi, gelir tahmini, sarf gideri ve çalışan yükü."
        aksiyonlar={<DonemSecici donem={donem} />}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatKarti etiket="Bugün paket" deger={sayi(pano.bugunToplam)} dipnot="tüm şirketler" ikon={Package} />
        <StatKarti etiket={`${donemAdi(donem)} paket`} deger={sayi(pano.donemToplam)} dipnot={`${pano.sirketler.filter((s) => s.donem > 0).length} aktif şirket`} ikon={Boxes} />
        <StatKarti etiket="Gelir tahmini" deger={para(pano.gelirTahmini)} dipnot="paket × tarife (KDV dâhil)" ikon={Coins} />
        <StatKarti etiket="Sarf gideri" deger={para(pano.sarfGideri)} dipnot="paket × norm × maliyet" ikon={Boxes} />
        <StatKarti etiket="Kâr tahmini" deger={para(pano.karTahmini)} dipnot={`Bakiye alacak ${para(pano.toplamBakiye)}`} ikon={TrendingUp} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <div>
          <h2 className="mb-2 text-title-3">Şirketler</h2>
          <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şirket</TableHead>
                  <TableHead className="text-right">Bugün</TableHead>
                  <TableHead className="text-right">Dönem</TableHead>
                  <TableHead className="text-right">Gelir tahmini</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pano.sirketler.map((s) => (
                  <TableRow key={s.sirketId}>
                    <TableCell className="font-semibold">
                      <Link href={`/stok?sirket=${s.sirketId}`} className="underline-offset-2 hover:underline">
                        {s.sirketAd}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-right">{sayi(s.bugun)}</TableCell>
                    <TableCell className="tabular text-right">{sayi(s.donem)}</TableCell>
                    <TableCell className="tabular text-right">{s.gelirTahmini === null ? <span className="text-warning">tarife yok</span> : para(s.gelirTahmini)}</TableCell>
                    <TableCell className="tabular text-right">
                      <span className={Number(s.bakiye) > 0 ? "font-semibold" : "text-muted-foreground"}>{para(s.bakiye)}</span>
                      {s.gecikmis > 0 && <span className="ml-1 text-caption text-destructive">· {s.gecikmis} gecikmiş</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 flex items-center gap-2 text-title-3">
            <Wallet className="h-4 w-4 text-[hsl(var(--vurgu-parlak))]" aria-hidden="true" />
            Çalışan yükü
          </h2>
          {pano.calisanlar.length === 0 ? (
            <p className="text-footnote text-muted-foreground">Bu dönemde okutma yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Çalışan</TableHead>
                    <TableHead className="text-right">Bugün</TableHead>
                    <TableHead className="text-right">Dönem</TableHead>
                    <TableHead className="text-right">Gün</TableHead>
                    <TableHead className="text-right">Paket/gün</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pano.calisanlar.map((c) => (
                    <TableRow key={c.kullaniciId}>
                      <TableCell>
                        <div className="font-semibold">{c.ad}</div>
                        <div className="text-caption text-muted-foreground">{c.sirketAd}</div>
                      </TableCell>
                      <TableCell className="tabular text-right">{sayi(c.bugun)}</TableCell>
                      <TableCell className="tabular text-right font-semibold">{sayi(c.donem)}</TableCell>
                      <TableCell className="tabular text-right">{sayi(c.gun)}</TableCell>
                      <TableCell className="tabular text-right">{ondalik(c.gunlukOrtalama)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-title-3">Yoğunluk — gün × saat</h2>
        <IsiHaritasi noktalar={pano.saatlik} />
      </div>
    </>
  );
}
