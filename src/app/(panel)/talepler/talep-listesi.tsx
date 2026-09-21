"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, MessageCircle, Trash2 } from "lucide-react";
import { teklifDurumKaydet, teklifSil } from "@/server/actions/teklif";
import { FormKabugu } from "@/components/panel/form-kabugu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { Button } from "@/components/ui/button";
import { Rozet } from "@/components/ui/rozet";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { telefonGorunum } from "@/lib/format/telefon";
import { tarihSaat } from "@/lib/format/tarih";
import type { TeklifDurumu, TeklifTalebi } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const DURUM_ETIKET: Record<TeklifDurumu, string> = {
  yeni: "Yeni",
  arandi: "Arandı",
  kazanildi: "Kazanıldı",
  kaybedildi: "Kaybedildi",
};

const DURUM_TON: Record<TeklifDurumu, "bilgi" | "uyari" | "basari" | "notr"> = {
  yeni: "bilgi",
  arandi: "uyari",
  kazanildi: "basari",
  kaybedildi: "notr",
};

/**
 * TEKLİF TALEPLERİ LİSTESİ.
 *
 * WHATSAPP'A GİTMEYENLER VURGULANIR: formu doldurup mesaj atmayan kişi asıl
 * aranacak kişidir - niyeti var ama son adımda düşmüş.
 */
export function TalepListesi({ satirlar }: { satirlar: TeklifTalebi[] }) {
  const router = useRouter();
  const [secili, setSecili] = useState<TeklifTalebi | null>(null);
  const [silinecek, setSilinecek] = useState<TeklifTalebi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [, basla] = useTransition();

  return (
    <div className="space-y-4">
      {hata && (
        <p role="alert" className="flex items-start gap-1.5 text-footnote font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hata}</span>
        </p>
      )}

      <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Kişi</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Hacim</TableHead>
              <TableHead>Pazaryerleri</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map((t) => (
              <TableRow key={t.id} className={cn(!t.whatsappAcildi && t.durum === "yeni" && "bg-warning-soft/40")}>
                <TableCell className="tabular whitespace-nowrap text-muted-foreground">{tarihSaat(t.createdAt)}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setSecili(t)}
                    className="text-left font-semibold underline-offset-2 hover:underline"
                  >
                    {t.ad ?? "İsim verilmedi"}
                  </button>
                  {t.sirket && <div className="text-caption text-muted-foreground">{t.sirket}</div>}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap">
                  <a href={`tel:+9${t.telefon}`} className="text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline">
                    {telefonGorunum(t.telefon)}
                  </a>
                </TableCell>
                <TableCell className="tabular">{t.aylikPaket ?? "—"}</TableCell>
                <TableCell className="max-w-[14rem] truncate text-muted-foreground">{t.pazaryerleri ?? "—"}</TableCell>
                <TableCell>
                  {t.whatsappAcildi ? (
                    <Rozet ton="basari">Gitti</Rozet>
                  ) : (
                    <Rozet ton="uyari">Gitmedi</Rozet>
                  )}
                </TableCell>
                <TableCell>
                  <Rozet ton={DURUM_TON[t.durum]}>{DURUM_ETIKET[t.durum]}</Rozet>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <a
                      href={`https://wa.me/9${t.telefon}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="WhatsApp'tan yaz"
                      className="press inline-flex h-8 w-8 items-center justify-center rounded-[--radius-kontrol] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <Button type="button" variant="ghost" size="icon" aria-label="Sil" onClick={() => setSilinecek(t)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FormKabugu acik={!!secili} onKapat={() => setSecili(null)} baslik={secili?.ad ?? "Teklif talebi"}>
        {secili && (
          <TalepDetay
            talep={secili}
            onBitti={() => {
              setSecili(null);
              router.refresh();
            }}
          />
        )}
      </FormKabugu>

      <OnayDiyalogu
        acik={!!silinecek}
        tehlikeli
        baslik="Talep silinsin mi?"
        aciklama={silinecek ? `${silinecek.ad ?? telefonGorunum(silinecek.telefon)} talebi kalıcı olarak silinir.` : undefined}
        onaylaMetni="Sil"
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          const t = silinecek;
          setSilinecek(null);
          if (!t) return;
          basla(async () => {
            const d = await teklifSil(t.id);
            if (!d.ok) setHata(d.mesaj ?? "Silinemedi.");
            else router.refresh();
          });
        }}
      />
    </div>
  );
}

function TalepDetay({ talep, onBitti }: { talep: TeklifTalebi; onBitti: () => void }) {
  const [durum, eylem, bekliyor] = useActionState(teklifDurumKaydet, undefined);
  useEffect(() => {
    if (durum?.ok) onBitti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-2 text-footnote sm:grid-cols-2">
        <Satir etiket="Telefon" deger={telefonGorunum(talep.telefon)} />
        <Satir etiket="Şirket" deger={talep.sirket} />
        <Satir etiket="E-posta" deger={talep.eposta} />
        <Satir etiket="Aylık paket" deger={talep.aylikPaket} />
        <Satir etiket="Pazaryerleri" deger={talep.pazaryerleri} />
        <Satir etiket="Geldiği kaynak" deger={talep.kaynak ?? talep.kampanya} />
        <Satir etiket="WhatsApp" deger={talep.whatsappAcildi ? "Mesaja gitti" : "Gitmedi"} />
        <Satir etiket="Tarih" deger={tarihSaat(talep.createdAt)} />
      </dl>

      {talep.mesaj && (
        <div>
          <div className="text-overline text-muted-foreground">Mesajı</div>
          <p className="mt-1 whitespace-pre-wrap text-body">{talep.mesaj}</p>
        </div>
      )}

      <form action={eylem} className="space-y-4 border-t border-border pt-4">
        <input type="hidden" name="id" value={talep.id} />
        <div className="space-y-1.5">
          <Label htmlFor="talep-durum">Durum</Label>
          <Select id="talep-durum" name="durum" defaultValue={talep.durum}>
            {(Object.keys(DURUM_ETIKET) as TeklifDurumu[]).map((d) => (
              <option key={d} value={d}>
                {DURUM_ETIKET[d]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="talep-not">Notunuz</Label>
          <textarea
            id="talep-not"
            name="notlar"
            rows={3}
            maxLength={500}
            defaultValue={talep.notlar ?? ""}
            placeholder="Görüşme notu, verilen fiyat..."
            className="w-full rounded-[--radius-kontrol] border border-input bg-background px-3 py-2 text-[0.9375rem] outline-none focus-visible:border-[hsl(var(--vurgu-parlak))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--vurgu-parlak))]/25"
          />
        </div>
        {durum && !durum.ok && durum.mesaj && (
          <p role="alert" className="text-footnote text-destructive">{durum.mesaj}</p>
        )}
        <div className="flex justify-end gap-2">
          <a
            href={`https://wa.me/9${talep.telefon}`}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex h-9 items-center gap-1.5 rounded-[--radius-kontrol] border border-input bg-card px-4 text-[0.875rem] font-medium hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
          <button
            type="submit"
            disabled={bekliyor}
            className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {bekliyor ? "Kaydediliyor" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{etiket}</dt>
      <dd className="tabular font-medium">{deger || "—"}</dd>
    </div>
  );
}
