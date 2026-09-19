"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { excelAktar, type ExcelDurumu } from "@/server/actions/urunler";
import {
  ALAN_ANAHTARLARI,
  ALAN_ETIKETLERI,
  ONIZLEME_SATIRI,
} from "@/lib/excel/sabitler";
import { Button } from "@/components/ui/button";
import { Rozet } from "@/components/ui/rozet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * EXCEL İLE İÇE AKTARMA - iki adım: ÖNİZLE, sonra KAYDET.
 *
 * Kullanıcı kaydetmeden önce iki şeyi görür: hangi sütunun hangi alana
 * bağlandığı ve ilk satırların nasıl okunduğu. Tek adımda yazan bir içe
 * aktarım, "Ürün Adı" sütununu barkod sanmışsa bunu ancak katalog bozulduktan
 * sonra fark ettirir - ve geri alma yoktur.
 *
 * DOSYA İKİ KEZ GÖNDERİLİR (önizleme + kaydetme). Ayrıştırılmış satırları
 * sunucuda tutmak 20.000 satırlık bir dosyayı iki tıklama arasında bellekte
 * bekletmek demekti; dosya zaten kullanıcının diskinde.
 */

export function ExcelAktar() {
  const [acik, setAcik] = useState(false);
  const [dosya, setDosya] = useState<File | null>(null);
  const [durum, setDurum] = useState<ExcelDurumu | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [pending, startTransition] = useTransition();
  const girisRef = useRef<HTMLInputElement | null>(null);

  const sifirla = () => {
    setDosya(null);
    setDurum(null);
    setKaydedildi(false);
    if (girisRef.current) girisRef.current.value = "";
  };

  const calistir = (secilen: File, mod: "onizle" | "kaydet") => {
    const veri = new FormData();
    veri.set("dosya", secilen);
    veri.set("mod", mod);
    startTransition(async () => {
      const cevap = await excelAktar(undefined, veri);
      setDurum(cevap);
      setKaydedildi(mod === "kaydet" && cevap.ok);
    });
  };

  const dosyaSecildi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const secilen = e.target.files?.[0] ?? null;
    setDosya(secilen);
    setDurum(null);
    setKaydedildi(false);
    if (secilen) calistir(secilen, "onizle");
  };

  if (!acik) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-border bg-card p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-title-3">
            <FileSpreadsheet
              className="h-4 w-4 text-[hsl(var(--vurgu-parlak))]"
              aria-hidden="true"
            />
            Excel ile içe aktar
          </h2>
          <p className="mt-1 max-w-[62ch] text-footnote text-muted-foreground">
            Pazaryerinden indirdiğiniz ürün listesini tek dosyada aktarın.
            Sütunlar otomatik eşleştirilir, kaydetmeden önce önizlersiniz.
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={() => setAcik(true)}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          Dosya aktar
        </Button>
      </div>
    );
  }

  const onizleme = durum?.onizleme;
  const kalan = onizleme ? onizleme.toplam - onizleme.ornekler.length : 0;

  return (
    <div className="animate-fade rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-title-3">
            <FileSpreadsheet
              className="h-4 w-4 text-[hsl(var(--vurgu-parlak))]"
              aria-hidden="true"
            />
            Excel ile içe aktar
          </h2>
          <p className="mt-1 max-w-[62ch] text-footnote text-muted-foreground">
            Dosyada “Barkod” sütunu bulunmalı. Ürün adı, görsel, marka, kategori
            ve stok kodu sütunları varsa otomatik eşleştirilir; boş bırakılan
            alan mevcut kaydı silmez.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            sifirla();
            setAcik(false);
          }}
          aria-label="Excel panelini kapat"
          className={cn(
            "press inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[--radius-kontrol]",
            "text-muted-foreground transition-colors duration-dokunma ease-out",
            "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label
          className={cn(
            "press inline-flex min-h-touch cursor-pointer items-center justify-center gap-2 rounded-[--radius-kontrol]",
            "border border-input bg-card px-4 text-[0.875rem] font-semibold text-foreground",
            "transition-colors duration-dokunma ease-out",
            "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          )}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {dosya ? "Başka dosya seç" : "Dosya seç (.xlsx)"}
          <input
            ref={girisRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={dosyaSecildi}
          />
        </label>

        {dosya && (
          <span className="min-w-0 truncate text-footnote text-muted-foreground">
            {dosya.name}
          </span>
        )}

        {pending && (
          <span className="inline-flex items-center gap-1.5 text-footnote text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Okunuyor
          </span>
        )}
      </div>

      {durum && !durum.ok && durum.mesaj && (
        <p
          role="alert"
          className="animate-fade mt-3 flex items-start gap-1.5 text-footnote font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{durum.mesaj}</span>
        </p>
      )}

      {kaydedildi && durum?.ok && (
        <p
          role="status"
          className="animate-fade mt-3 flex items-start gap-1.5 text-footnote font-medium text-success"
        >
          <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{durum.mesaj}</span>
        </p>
      )}

      {onizleme && onizleme.toplam > 0 && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <p className="text-overline text-muted-foreground">Sütun eşleşmesi</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {ALAN_ANAHTARLARI.map((alan) => {
                const baslik = onizleme.sutunlar[alan];
                return (
                  <li key={alan}>
                    <Rozet ton={baslik ? "basari" : "notr"}>
                      {ALAN_ETIKETLERI[alan]}
                      {baslik ? `: ${baslik}` : ": yok"}
                    </Rozet>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="tabular text-footnote text-muted-foreground">
            {onizleme.toplam} satır okundu
            {onizleme.baslikSatiri !== null
              ? ` (başlık satırı ${onizleme.baslikSatiri})`
              : ""}
            {onizleme.atlanan > 0
              ? `, ${onizleme.atlanan} satır barkodu boş olduğu için atlandı`
              : ""}
            .
          </p>

          <div className="rounded-[--radius] border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barkod</TableHead>
                  <TableHead>Ürün adı</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Stok kodu</TableHead>
                  <TableHead>Görsel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onizleme.ornekler.map((s, i) => (
                  <TableRow key={`${s.barkod}-${i}`}>
                    <TableCell className="tabular whitespace-nowrap">{s.barkod}</TableCell>
                    <TableCell className="max-w-[18rem] truncate">{s.urunAdi || "-"}</TableCell>
                    <TableCell className="max-w-[8rem] truncate text-muted-foreground">
                      {s.marka || "-"}
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate text-muted-foreground">
                      {s.kategori || "-"}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {s.stokKodu || "-"}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                      {s.gorselUrl || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {kalan > 0 && (
            <p className="tabular text-caption text-muted-foreground">
              İlk {ONIZLEME_SATIRI} satır gösteriliyor; {kalan} satır daha var.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={sifirla} disabled={pending}>
              Vazgeç
            </Button>
            <Button
              onClick={() => dosya && calistir(dosya, "kaydet")}
              disabled={pending || !dosya || kaydedildi}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {kaydedildi ? "Kaydedildi" : `${onizleme.toplam} ürünü kaydet`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
