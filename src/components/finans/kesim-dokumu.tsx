import { Rozet } from "@/components/ui/rozet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { para, sayi } from "@/lib/format/sayi";
import { tarih, tarihSaat } from "@/lib/format/tarih";
import { donemAdi } from "@/lib/finans/hesap";
import type { KesimDetayi } from "@/lib/db/repos/finans";

const DURUM: Record<string, { ad: string; ton: "notr" | "bilgi" | "basari" | "hata" }> = {
  taslak: { ad: "Taslak", ton: "notr" },
  kesildi: { ad: "Kesildi", ton: "bilgi" },
  odendi: { ad: "Ödendi", ton: "basari" },
  iptal: { ad: "İptal", ton: "hata" },
};

/**
 * Kesim dökümü — süper yönetici (hesap-kesimi/[id]) ve kiracı (hesabim/[id])
 * aynı bileşeni görür; yazdırılabilir (tarayıcı yazdırma, sayfa CSS'i).
 */
export function KesimDokumu({ kesim }: { kesim: KesimDetayi }) {
  const r = DURUM[kesim.durum] ?? DURUM.taslak!;
  const kalan = Number(kesim.genelToplam) - Number(kesim.odenen);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-[--radius] border border-border bg-card p-4 text-footnote sm:grid-cols-2 sm:p-5">
        <div>
          <div className="text-overline text-muted-foreground">Şirket</div>
          <div className="text-headline text-foreground">{kesim.sirketAd}</div>
        </div>
        <div>
          <div className="text-overline text-muted-foreground">Dönem</div>
          <div className="text-headline text-foreground">{donemAdi(kesim.donem)}</div>
        </div>
        <div>
          <div className="text-overline text-muted-foreground">Durum</div>
          <div className="mt-1">
            <Rozet ton={r.ton}>{r.ad}</Rozet>
          </div>
        </div>
        <div>
          <div className="text-overline text-muted-foreground">Fatura</div>
          <div className="tabular">
            {kesim.faturaNo ?? "—"}
            {kesim.kesimTarihi && <span className="text-muted-foreground"> · {tarihSaat(kesim.kesimTarihi)}</span>}
            {kesim.vadeTarihi && <span className="text-muted-foreground"> · vade {tarih(kesim.vadeTarihi)}</span>}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Açıklama</TableHead>
              <TableHead className="text-right">Adet</TableHead>
              <TableHead className="text-right">Birim</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kesim.kalemler.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.aciklama}</TableCell>
                <TableCell className="tabular text-right">{sayi(Number(k.adet))}</TableCell>
                <TableCell className="tabular text-right">{para(k.birimFiyat)}</TableCell>
                <TableCell className="tabular text-right font-semibold">{para(k.tutar)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right text-muted-foreground">Ara toplam</TableCell>
              <TableCell className="tabular text-right">{para(kesim.araToplam)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3} className="text-right text-muted-foreground">KDV %{Number(kesim.kdvOrani)}</TableCell>
              <TableCell className="tabular text-right">{para(kesim.kdvTutari)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3} className="text-right font-semibold">Genel toplam</TableCell>
              <TableCell className="tabular text-right text-headline">{para(kesim.genelToplam)}</TableCell>
            </TableRow>
            {kesim.durum !== "taslak" && (
              <>
                <TableRow>
                  <TableCell colSpan={3} className="text-right text-muted-foreground">Ödenen</TableCell>
                  <TableCell className="tabular text-right">{para(kesim.odenen)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold">Kalan</TableCell>
                  <TableCell className={`tabular text-right font-semibold ${kalan > 0.004 ? "text-destructive" : "text-success"}`}>{para(kalan)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {kesim.odemeler.length > 0 && (
        <div className="rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ödeme tarihi</TableHead>
                <TableHead>Yöntem</TableHead>
                <TableHead>Not</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kesim.odemeler.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="tabular">{tarih(o.tarih)}</TableCell>
                  <TableCell>{o.yontem.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{o.not ?? "—"}</TableCell>
                  <TableCell className="tabular text-right">{para(o.tutar)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
