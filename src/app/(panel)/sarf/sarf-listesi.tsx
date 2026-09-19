"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeftRight, PackageOpen, Pencil, Trash2 } from "lucide-react";
import { sarfSil } from "@/server/actions/sarf";
import { BosDurum } from "@/components/panel/bos-durum";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { FormKabugu } from "@/components/panel/form-kabugu";
import { Button } from "@/components/ui/button";
import { Rozet } from "@/components/ui/rozet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ondalik, para, sayi } from "@/lib/format/sayi";
import { tarih } from "@/lib/format/tarih";
import type { SarfHareketi } from "@/lib/db/schema";
import type { SarfSatiri } from "@/lib/db/repos/sarf";
import { HareketFormu, SarfFormu } from "./sarf-formu";
import { cn } from "@/lib/utils";

const TUR: Record<string, string> = { alim: "Alım", sayim: "Sayım", duzeltme: "Düzeltme" };

export function SarfListesi({ liste, secili, hareketler }: { liste: SarfSatiri[]; secili: string | null; hareketler: SarfHareketi[] }) {
  const router = useRouter();
  const yol = usePathname();
  const [duzenlenen, setDuzenlenen] = useState<SarfSatiri | null>(null);
  const [hareket, setHareket] = useState<SarfSatiri | null>(null);
  const [silinecek, setSilinecek] = useState<SarfSatiri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [, basla] = useTransition();
  const seciliSatir = liste.find((s) => s.id === secili) ?? null;
  const kapat = () => {
    setDuzenlenen(null);
    setHareket(null);
    router.refresh();
  };

  if (liste.length === 0) {
    return <BosDurum ikon={PackageOpen} baslik="Henüz sarf malzemesi yok" aciklama="Koli, patpat, bant, kargo poşeti gibi malzemeleri “Malzeme ekle” ile tanımlayın; paket başı norm girin." />;
  }

  return (
    <div className="space-y-4">
      {hata && (
        <p role="alert" className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hata}</span>
        </p>
      )}
      <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Malzeme</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Norm/paket</TableHead>
              <TableHead className="text-right">Tükenme</TableHead>
              <TableHead className="text-right">Birim maliyet</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.map((s) => (
              <TableRow key={s.id} className={cn(secili === s.id && "bg-accent/50", s.durum === "eksi" && "bg-destructive-soft/40", s.durum === "kritik" && "bg-warning-soft/40")}>
                <TableCell>
                  <button type="button" className="text-left font-semibold underline-offset-2 hover:underline" onClick={() => router.push(`${yol}?sec=${s.id}`)}>
                    {s.ad}
                  </button>
                  {!s.aktif && <Rozet ton="notr" className="ml-2">Pasif</Rozet>}
                </TableCell>
                <TableCell className={cn("tabular text-right font-semibold", s.stok < 0 && "text-destructive")}>
                  {ondalik(s.stok)} {s.birim}
                </TableCell>
                <TableCell className="tabular text-right">{ondalik(Number(s.paketBasiNorm))}</TableCell>
                <TableCell className="tabular text-right">{s.tukenmeGun === null ? "—" : `${sayi(s.tukenmeGun)} gün`}</TableCell>
                <TableCell className="tabular text-right">{para(Number(s.birimMaliyet))}</TableCell>
                <TableCell>{s.durum === "kritik" ? <Rozet ton="uyari">Kritik</Rozet> : s.durum === "eksi" ? <Rozet ton="hata">Eksi</Rozet> : null}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setHareket(s)}>
                      <ArrowLeftRight aria-hidden="true" />
                      Hareket
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Düzenle" onClick={() => setDuzenlenen(s)}>
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Sil" onClick={() => setSilinecek(s)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {seciliSatir && (
        <div>
          <h2 className="mb-2 text-title-3">
            {seciliSatir.ad} — hareketler
            <span className="tabular ml-2 text-footnote font-normal text-muted-foreground">
              tüketim {ondalik(seciliSatir.normSonrasiPaket * Number(seciliSatir.paketBasiNorm))} {seciliSatir.birim} ({sayi(seciliSatir.normSonrasiPaket)} paket × {ondalik(Number(seciliSatir.paketBasiNorm))})
            </span>
          </h2>
          {hareketler.length === 0 ? (
            <p className="text-footnote text-muted-foreground">Henüz hareket yok.</p>
          ) : (
            <div className="rounded-[--radius] border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Not</TableHead>
                    <TableHead>Kaydeden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hareketler.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="tabular">{tarih(h.tarih)}</TableCell>
                      <TableCell>{TUR[h.tur] ?? h.tur}</TableCell>
                      <TableCell className="tabular text-right">{Number(h.miktar) > 0 ? "+" : ""}{ondalik(Number(h.miktar))}</TableCell>
                      <TableCell className="tabular text-right">{h.tutar ? para(h.tutar) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.not ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.kaydedenAd}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <FormKabugu acik={!!duzenlenen} onKapat={() => setDuzenlenen(null)} baslik="Sarf malzemesini düzenle">
        {duzenlenen && <SarfFormu key={duzenlenen.id} sarf={duzenlenen} onBitti={kapat} />}
      </FormKabugu>
      <FormKabugu acik={!!hareket} onKapat={() => setHareket(null)} baslik={hareket ? `${hareket.ad} · hareket` : ""}>
        {hareket && <HareketFormu key={hareket.id} sarf={hareket} onBitti={kapat} />}
      </FormKabugu>
      <OnayDiyalogu
        acik={!!silinecek}
        tehlikeli
        baslik="Sarf malzemesi silinsin mi?"
        aciklama={silinecek ? `${silinecek.ad} ve tüm hareketleri silinir.` : undefined}
        onaylaMetni="Sil"
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          const h = silinecek;
          setSilinecek(null);
          if (!h) return;
          basla(async () => {
            const d = await sarfSil(h.id);
            if (!d.ok) setHata(d.mesaj ?? "Silinemedi.");
            else router.refresh();
          });
        }}
      />
    </div>
  );
}
