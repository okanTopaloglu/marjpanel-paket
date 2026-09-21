import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Rozet } from "@/components/ui/rozet";
import { telefonGorunum } from "@/lib/format/telefon";
import { tarihSaat } from "@/lib/format/tarih";
import { sayi } from "@/lib/format/sayi";
import type { YeniKayit } from "@/lib/db/repos/sirketler";

/**
 * KENDİ KENDİNE AÇILAN HESAPLAR — `/kayit` akışından gelen şirketler.
 * Sunucu bileşeni: burada eylem yok, yalnız okuma.
 */
export function YeniKayitTablosu({ satirlar }: { satirlar: YeniKayit[] }) {
  return (
    <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Şirket</TableHead>
            <TableHead>Yetkili</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>E-posta</TableHead>
            <TableHead className="text-right">Okutma</TableHead>
            <TableHead>Kayıt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {satirlar.map((s) => (
            <TableRow key={s.kullaniciId}>
              <TableCell className="font-semibold">
                {s.sirketAd}
                {s.alanAdi && <div className="text-caption font-normal text-muted-foreground">{s.alanAdi}</div>}
              </TableCell>
              <TableCell>{s.ad}</TableCell>
              <TableCell className="tabular">
                <a href={`tel:+9${s.telefon}`} className="text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline">
                  {telefonGorunum(s.telefon)}
                </a>
              </TableCell>
              <TableCell>
                {s.eposta ? (
                  <a href={`mailto:${s.eposta}`} className="text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline">
                    {s.eposta}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular text-right">
                {s.okutmaSayisi > 0 ? sayi(s.okutmaSayisi) : <Rozet ton="notr">henüz yok</Rozet>}
              </TableCell>
              <TableCell className="tabular text-muted-foreground">{tarihSaat(s.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
