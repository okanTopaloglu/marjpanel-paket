"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, PackagePlus, Trash2 } from "lucide-react";
import { malKabulSil } from "@/server/actions/mal-kabul";
import { BosDurum } from "@/components/panel/bos-durum";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { SayfaGezinme } from "@/components/tables/sayfa-gezinme";
import { Button } from "@/components/ui/button";
import { Rozet } from "@/components/ui/rozet";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tarih } from "@/lib/format/tarih";
import { sayi } from "@/lib/format/sayi";
import type { MalKabulSatiri } from "@/lib/db/repos/mal-kabul";

const TUR_ETIKET: Record<string, { ad: string; ton: "basari" | "uyari" | "bilgi" }> = {
  kabul: { ad: "Kabul", ton: "basari" },
  iade: { ad: "İade", ton: "uyari" },
  duzeltme: { ad: "Düzeltme", ton: "bilgi" },
};

export function MalKabulListesi({
  satirlar,
  toplam,
  sayfa,
  limit,
  sirketler,
  seciliSirket,
}: {
  satirlar: MalKabulSatiri[];
  toplam: number;
  sayfa: number;
  limit: number;
  sirketler: { id: string; ad: string }[];
  seciliSirket: string;
}) {
  const router = useRouter();
  const yol = usePathname();
  const sp = useSearchParams();
  const [silinecek, setSilinecek] = useState<MalKabulSatiri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [, basla] = useTransition();

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
      <div className="max-w-xs">
        <Select value={seciliSirket} onChange={(e) => git({ sirket: e.target.value, sayfa: "" })} aria-label="Şirket filtresi">
          <option value="">Tüm şirketler</option>
          {sirketler.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ad}
            </option>
          ))}
        </Select>
      </div>

      {hata && (
        <p role="alert" className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hata}</span>
        </p>
      )}

      {satirlar.length === 0 ? (
        <BosDurum
          ikon={PackagePlus}
          baslik="Henüz mal kabul fişi yok"
          aciklama="Şirketten gelen malı “Fiş ekle” ile sayın; stok raporu bu fişlerden hesaplanır."
        />
      ) : (
        <div className="rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Şirket</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>İrsaliye</TableHead>
                <TableHead className="text-right">Kalem</TableHead>
                <TableHead className="text-right">Adet</TableHead>
                <TableHead>Kaydeden</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {satirlar.map((f) => {
                const t = TUR_ETIKET[f.tur] ?? TUR_ETIKET.kabul!;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="tabular">
                      <Link href={`/mal-kabul/${f.id}`} className="font-semibold text-foreground underline-offset-2 hover:underline">
                        {tarih(f.tarih)}
                      </Link>
                    </TableCell>
                    <TableCell>{f.sirketAd}</TableCell>
                    <TableCell>
                      <Rozet ton={t.ton}>{t.ad}</Rozet>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">{f.irsaliyeNo ?? "—"}</TableCell>
                    <TableCell className="tabular text-right">{sayi(f.kalemSayisi)}</TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {f.toplamAdet > 0 ? "+" : ""}
                      {sayi(f.toplamAdet)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.kaydedenAd}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" aria-label="Fişi sil" onClick={() => setSilinecek(f)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <SayfaGezinme sayfa={sayfa} sayfaSayisi={Math.max(1, Math.ceil(toplam / limit))} onSayfa={(n) => git({ sayfa: n === 0 ? "" : String(n + 1) })} />

      <OnayDiyalogu
        acik={!!silinecek}
        tehlikeli
        baslik="Fiş silinsin mi?"
        aciklama={silinecek ? `${silinecek.sirketAd} · ${tarih(silinecek.tarih)} · ${silinecek.kalemSayisi} kalem. Stok raporu buna göre yeniden hesaplanır.` : undefined}
        onaylaMetni="Fişi sil"
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          const h = silinecek;
          setSilinecek(null);
          if (!h) return;
          basla(async () => {
            const d = await malKabulSil(h.id);
            if (!d.ok) setHata(d.mesaj ?? "Silinemedi.");
            else router.refresh();
          });
        }}
      />
    </div>
  );
}
