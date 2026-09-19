"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Pencil, ScanLine, Trash2, Truck } from "lucide-react";
import { kuralAktiflik, kuralSil } from "@/server/actions/barkod-kurallari";
import {
  barkodTemizle,
  kuralEslestir,
  type EslesmeKurali,
} from "@/lib/barkod/coz";
import { BILINMEYEN } from "@/lib/barkod/varsayilan-kurallar";
import { BosDurum } from "@/components/panel/bos-durum";
import { IslemlerMenusu, type IslemMaddesi } from "@/components/panel/islemler-menusu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { KuralFormu } from "./kural-formu";
import type { KuralSatiri } from "@/lib/db/repos/barkod-kurallari";

/**
 * KURAL LİSTESİ.
 *
 * SIRA EŞLEŞME SIRASIDIR (öncelik artan → uzun önek önce → şirket kuralı
 * globalden önce), alfabetik değil: tablo "hangi kural önce denenir"
 * sorusunun cevabıdır. Sorgu bu sırayla döndürür (repos/barkod-kurallari).
 *
 * "BARKODU DENE" kutusu eşleşmeyi İSTEMCİDE, okutmayla AYNI saf fonksiyonla
 * (`kuralEslestir`) çalıştırır. Sunucuya gitmeden anında cevap verir ve
 * kullanıcı kuralı kaydetmeden önce sonucunu görür - "neden bu paket Aras'a
 * düştü" sorusunun cevabı burada aranır.
 */

/** Liste satırını eşleme motorunun beklediği şekle çevirir. */
function eslesmeKurali(s: KuralSatiri): EslesmeKurali {
  return {
    barkodOneki: s.barkodOneki,
    kaynak: s.kaynak,
    kargoFirmasi: s.kargoFirmasi,
    oncelik: s.oncelik,
    aktif: s.aktif,
    // Şirket kuralı öncelik eşitliğinde globali ezer; motor bunu `sirketId`
    // dolu mu diye bakarak anlar, kimliğin kendisini kullanmaz.
    sirketId: s.kapsam === "sirket" ? "sirket" : null,
  };
}

function BarkodDene({ kurallar }: { kurallar: KuralSatiri[] }) {
  const [barkod, setBarkod] = useState("");
  const motorKurallari = useMemo(() => kurallar.map(eslesmeKurali), [kurallar]);

  const temiz = barkodTemizle(barkod);
  const sonuc = temiz ? kuralEslestir(motorKurallari, temiz) : null;
  const eslesenOnek = temiz
    ? [...kurallar]
        .filter((k) => k.aktif && temiz.startsWith(k.barkodOneki.toUpperCase()))
        .sort((a, b) => a.oncelik - b.oncelik || b.barkodOneki.length - a.barkodOneki.length)[0]
    : null;

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 space-y-1.5 sm:max-w-sm sm:flex-1">
          <Label htmlFor="barkod-dene">Barkodu dene</Label>
          <div className="relative">
            <ScanLine
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="barkod-dene"
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
              placeholder="7261234567890"
              autoComplete="off"
              className="tabular pl-8"
              aria-describedby="barkod-dene-sonuc"
            />
          </div>
        </div>

        <div id="barkod-dene-sonuc" aria-live="polite" className="min-w-0 pb-1.5">
          {sonuc === null ? (
            <p className="text-footnote text-muted-foreground">
              Bir barkod yazın; hangi kuralın eşleştiğini burada görürsünüz.
            </p>
          ) : sonuc.bilinmiyor && !eslesenOnek ? (
            <p className="text-footnote font-medium text-warning">
              Hiçbir kural eşleşmedi. Bu barkod {BILINMEYEN} olarak kaydedilir.
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-1.5 text-footnote text-foreground">
              {eslesenOnek && (
                <span className="font-mono text-caption font-semibold tracking-[0.04em] text-muted-foreground">
                  {eslesenOnek.barkodOneki}
                </span>
              )}
              <Rozet ton="bilgi">{sonuc.kaynak}</Rozet>
              <Rozet ton="basari">{sonuc.kargoFirmasi}</Rozet>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Aktiflik anahtarı - tek satırda açık/kapalı geçişi. */
function AktiflikAnahtari({
  aktif,
  pasifMi,
  etiket,
  onDegis,
}: {
  aktif: boolean;
  pasifMi: boolean;
  etiket: string;
  onDegis: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      aria-label={etiket}
      disabled={pasifMi}
      onClick={onDegis}
      className={cn(
        "press inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border p-0.5",
        "transition-colors duration-dokunma ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        aktif ? "border-primary bg-primary" : "border-input bg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-4 rounded-full bg-card shadow-soft",
          "transition-transform duration-dokunma ease-out",
          aktif ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function KuralListesi({
  kurallar,
  superMi,
}: {
  kurallar: KuralSatiri[];
  superMi: boolean;
}) {
  const [duzenlenen, setDuzenlenen] = useState<KuralSatiri | null>(null);
  const [silinecek, setSilinecek] = useState<KuralSatiri | null>(null);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <BarkodDene kurallar={kurallar} />

      {hataMesaji && (
        <p
          role="alert"
          className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hataMesaji}</span>
        </p>
      )}

      {kurallar.length === 0 ? (
        <BosDurum
          ikon={Truck}
          baslik="Henüz kural yok"
          aciklama="Kural, barkodun başındaki karakterlerden paketin hangi pazaryerine ve hangi kargoya ait olduğunu çıkarır. “Kural ekle” ile ilkini tanımlayın."
        />
      ) : (
        <div className="rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Önek</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Kargo firması</TableHead>
                <TableHead className="text-right">Öncelik</TableHead>
                <TableHead>Kapsam</TableHead>
                <TableHead>Aktif</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kurallar.map((k) => {
                const maddeler: IslemMaddesi[] = [
                  {
                    key: "duzenle",
                    etiket: "Düzenle",
                    ikon: Pencil,
                    pasif: !k.duzenlenebilir,
                    aciklama: k.duzenlenebilir
                      ? undefined
                      : "Genel kuralı yalnız platform yöneticisi değiştirir.",
                    onSelect: () => setDuzenlenen(k),
                  },
                  {
                    key: "sil",
                    etiket: "Sil",
                    ikon: Trash2,
                    tehlikeli: true,
                    pasif: !k.duzenlenebilir,
                    onSelect: () => setSilinecek(k),
                  },
                ];

                return (
                  <TableRow key={k.id} className={k.aktif ? undefined : "opacity-60"}>
                    <TableCell className="font-mono text-callout font-semibold tracking-[0.04em] whitespace-nowrap">
                      {k.barkodOneki}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{k.kaynak}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {k.kargoFirmasi}
                    </TableCell>
                    <TableCell className="tabular text-right">{k.oncelik}</TableCell>
                    <TableCell>
                      <Rozet ton={k.kapsam === "global" ? "notr" : "bilgi"}>
                        {k.kapsam === "global" ? "Genel" : "Şirket"}
                      </Rozet>
                    </TableCell>
                    <TableCell>
                      <AktiflikAnahtari
                        aktif={k.aktif}
                        pasifMi={!k.duzenlenebilir}
                        etiket={`${k.barkodOneki} kuralı aktif`}
                        onDegis={() => {
                          setHataMesaji(null);
                          startTransition(async () => {
                            const durum = await kuralAktiflik(k.id, !k.aktif);
                            if (!durum.ok) {
                              setHataMesaji(durum.mesaj ?? "İşlem başarısız.");
                            }
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-[18rem] truncate text-muted-foreground">
                      {k.aciklama ?? "-"}
                    </TableCell>
                    <TableCell>
                      <IslemlerMenusu maddeler={maddeler} yalnizIkon />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <KuralFormu
        acik={duzenlenen !== null}
        onKapat={() => setDuzenlenen(null)}
        kural={duzenlenen ?? undefined}
        superMi={superMi}
      />

      <OnayDiyalogu
        acik={silinecek !== null}
        baslik={`${silinecek?.barkodOneki ?? ""} kuralı silinsin mi?`}
        aciklama="Bu önekle başlayan barkodlar bundan sonra başka bir kurala düşer; hiçbiri eşleşmezse kaynak ve kargo “Bilinmiyor” olarak kaydedilir."
        onaylaMetni="Sil"
        tehlikeli
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          if (!silinecek) return;
          const id = silinecek.id;
          setSilinecek(null);
          setHataMesaji(null);
          startTransition(async () => {
            const durum = await kuralSil(id);
            if (!durum.ok) setHataMesaji(durum.mesaj ?? "Kural silinemedi.");
          });
        }}
      />

      {pending && (
        <span className="sr-only" role="status">
          İşleniyor…
        </span>
      )}
    </div>
  );
}
