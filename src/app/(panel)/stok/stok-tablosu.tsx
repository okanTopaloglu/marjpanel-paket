"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageOff, Search, Warehouse } from "lucide-react";
import { BosDurum } from "@/components/panel/bos-durum";
import { SayfaGezinme } from "@/components/tables/sayfa-gezinme";
import { Input } from "@/components/ui/input";
import { Rozet } from "@/components/ui/rozet";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ondalik, sayi } from "@/lib/format/sayi";
import type { StokSatiri } from "@/lib/db/repos/stok";
import { cn } from "@/lib/utils";

const DURUM: Record<StokSatiri["durum"], { ad: string; ton: "hata" | "uyari" | "notr" | "basari" } | null> = {
  eksi: { ad: "Eksi", ton: "hata" },
  kritik: { ad: "Kritik", ton: "uyari" },
  hareketsiz: { ad: "Hareketsiz", ton: "notr" },
  normal: null,
};

function AramaKutusu({ deger, onChange }: { deger: string; onChange: (v: string) => void }) {
  const [yerel, setYerel] = useState(deger);
  const z = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (z.current == null) setYerel(deger);
  }, [deger]);
  const gonder = (v: string) => {
    if (z.current) clearTimeout(z.current);
    z.current = null;
    if (v !== deger) onChange(v);
  };
  return (
    <div className="relative max-w-sm flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={yerel}
        aria-label="Stokta ara"
        placeholder="Barkod, ürün adı ya da stok kodu"
        className="pl-8"
        onChange={(e) => {
          const v = e.target.value;
          setYerel(v);
          if (z.current) clearTimeout(z.current);
          z.current = setTimeout(() => gonder(v), 350);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            gonder(yerel);
          }
        }}
      />
    </div>
  );
}

export function StokTablosu({
  satirlar,
  toplam,
  sayfa,
  limit,
  arama,
  sirketler,
  seciliSirket,
}: {
  satirlar: StokSatiri[];
  toplam: number;
  sayfa: number;
  limit: number;
  arama: string;
  sirketler: { id: string; ad: string }[];
  seciliSirket: string;
}) {
  const router = useRouter();
  const yol = usePathname();
  const sp = useSearchParams();

  function git(degisiklik: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(degisiklik)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`${yol}?${p.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {sirketler.length > 0 && (
          <Select value={seciliSirket} onChange={(e) => git({ sirket: e.target.value, sayfa: "" })} aria-label="Şirket" className="sm:max-w-xs">
            {sirketler.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad}
              </option>
            ))}
          </Select>
        )}
        <AramaKutusu deger={arama} onChange={(v) => git({ arama: v, sayfa: "" })} />
      </div>

      {satirlar.length === 0 ? (
        <BosDurum
          ikon={Warehouse}
          baslik={arama ? "Eşleşen ürün yok" : "Henüz stok hareketi yok"}
          aciklama={arama ? "Başka bir barkod ya da ad deneyin." : "Mal kabul fişi girildiğinde ve paket okutuldukça bu tablo dolar."}
        />
      ) : (
        <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Giren</TableHead>
                <TableHead className="text-right">Çıkan</TableHead>
                <TableHead className="text-right">Kalan</TableHead>
                <TableHead className="text-right">30g çıkış</TableHead>
                <TableHead className="text-right">Tükenme</TableHead>
                <TableHead className="text-right">Devir</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {satirlar.map((s) => {
                const d = DURUM[s.durum];
                return (
                  <TableRow key={s.barkod} className={cn(s.durum === "eksi" && "bg-destructive-soft/40", s.durum === "kritik" && "bg-warning-soft/40")}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {s.gorselUrl ? (
                          <Image src={s.gorselUrl} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-[--radius-kontrol] border border-border object-cover" />
                        ) : (
                          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-kontrol] border border-border bg-muted text-muted-foreground">
                            <ImageOff className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-callout font-semibold text-foreground">{s.urunAdi ?? "—"}</div>
                          <div className="tabular text-caption text-muted-foreground">
                            {s.barkod}
                            {!s.katalogda && <span className="ml-1.5 text-warning">· katalogda yok</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right">{sayi(s.giren)}</TableCell>
                    <TableCell className="tabular text-right">{sayi(s.cikan)}</TableCell>
                    <TableCell className={cn("tabular text-right font-semibold", s.kalan < 0 && "text-destructive")}>{sayi(s.kalan)}</TableCell>
                    <TableCell className="tabular text-right">{sayi(s.son30Cikis)}</TableCell>
                    <TableCell className="tabular text-right">{s.tukenmeGun === null ? "—" : `${sayi(s.tukenmeGun)} gün`}</TableCell>
                    <TableCell className="tabular text-right">{ondalik(s.devirHizi)}</TableCell>
                    <TableCell>{d ? <Rozet ton={d.ton}>{d.ad}</Rozet> : null}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <SayfaGezinme sayfa={sayfa} sayfaSayisi={Math.max(1, Math.ceil(toplam / limit))} onSayfa={(n) => git({ sayfa: n === 0 ? "" : String(n + 1) })} />
    </div>
  );
}
