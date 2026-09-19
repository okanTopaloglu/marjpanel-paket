import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { Rozet } from "@/components/ui/rozet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getir } from "@/lib/db/repos/mal-kabul";
import { tarihSaat } from "@/lib/format/tarih";
import { sayi } from "@/lib/format/sayi";

export const metadata: Metadata = { title: "Mal kabul fişi" };
export const dynamic = "force-dynamic";

const TUR: Record<string, string> = { kabul: "Mal kabul", iade: "İade", duzeltme: "Sayım düzeltme" };

export default async function MalKabulDetaySayfasi({ params }: { params: Promise<{ id: string }> }) {
  await superKapsamiZorunlu();
  const { id } = await params;
  const fis = await getir(id);
  if (!fis) notFound();

  return (
    <>
      <SayfaBasligi
        baslik={`${TUR[fis.tur] ?? fis.tur} · ${fis.sirketAd}`}
        aciklama={`${tarihSaat(fis.tarih)} · ${fis.kaydedenAd}${fis.irsaliyeNo ? ` · İrsaliye ${fis.irsaliyeNo}` : ""}`}
        geri={{ href: "/mal-kabul", etiket: "Mal kabul" }}
      />

      {fis.not && <p className="mb-4 text-footnote text-muted-foreground">{fis.not}</p>}

      <div className="rounded-[--radius] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barkod</TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead className="text-right">Adet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fis.kalemler.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="tabular font-semibold">{k.barkod}</TableCell>
                <TableCell>
                  {k.urunAdi ?? <Rozet ton="uyari">Katalogda yok</Rozet>}
                </TableCell>
                <TableCell className="tabular text-right">
                  {k.adet > 0 ? "+" : ""}
                  {sayi(k.adet)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} className="text-right text-muted-foreground">
                Toplam
              </TableCell>
              <TableCell className="tabular text-right font-semibold">
                {fis.toplamAdet > 0 ? "+" : ""}
                {sayi(fis.toplamAdet)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  );
}
