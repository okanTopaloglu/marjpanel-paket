"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { malKabulKaydet } from "@/server/actions/mal-kabul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import { gunAnahtari } from "@/lib/format/tarih";
import { cn } from "@/lib/utils";

interface SirketSecenegi {
  id: string;
  ad: string;
}

interface Satir {
  key: number;
  barkod: string;
  adet: string;
}

const TUR_ACIKLAMA: Record<string, string> = {
  kabul: "Şirketten gelen mal; adetler stoğa EKLENİR.",
  iade: "Şirkete geri gönderilen mal; adetler stoktan DÜŞER (pozitif yazın).",
  duzeltme: "Sayım farkı; eksi ya da artı yazılabilir (örn. -3 fire, +2 fazla).",
};

/**
 * Mal kabul fişi formu.
 *
 * İKİ GİRİŞ YOLU AYNI ANDA: satır satır (barkod okuyucu dostu — Enter bir
 * sonraki satıra geçer) ve yapıştırma (Excel'den iki sütun). Sunucu ikisini
 * birleştirir, aynı barkodu toplar. Satırlar formla `satirlar` JSON'u olarak
 * gider; kontrol edilmemiş input listesi yerine tek alan, sunucu tarafı
 * ayrıştırıcı da böylece test edilebilir kalır.
 */
function MalKabulFormIcerigi({ sirketler, onBasarili }: { sirketler: SirketSecenegi[]; onBasarili: () => void }) {
  const [durum, formAction] = useActionState(malKabulKaydet, undefined);
  const [tur, setTur] = useState("kabul");
  const [satirlar, setSatirlar] = useState<Satir[]>([{ key: 1, barkod: "", adet: "1" }]);
  const [yapistirAcik, setYapistirAcik] = useState(false);
  const sayac = useRef(2);
  const girisler = useRef<Map<number, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (durum?.ok) onBasarili();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  function satirEkle(odakla = true) {
    const key = sayac.current++;
    setSatirlar((s) => [...s, { key, barkod: "", adet: "1" }]);
    if (odakla) setTimeout(() => girisler.current.get(key)?.focus(), 0);
  }

  function guncelle(key: number, alan: "barkod" | "adet", deger: string) {
    setSatirlar((s) => s.map((r) => (r.key === key ? { ...r, [alan]: deger } : r)));
  }

  const toplam = satirlar.reduce((t, r) => t + (Number(r.adet) || 0), 0);
  const hata = durum && !durum.ok ? durum.mesaj : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="satirlar" value={JSON.stringify(satirlar.map(({ barkod, adet }) => ({ barkod, adet })))} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mk-sirket">Şirket</Label>
          <Select id="mk-sirket" name="sirketId" required defaultValue="">
            <option value="" disabled>
              Şirket seçin
            </option>
            {sirketler.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mk-tur">Fiş türü</Label>
          <Select id="mk-tur" name="tur" value={tur} onChange={(e) => setTur(e.target.value)}>
            <option value="kabul">Mal kabul (+)</option>
            <option value="iade">İade (−)</option>
            <option value="duzeltme">Sayım düzeltme (±)</option>
          </Select>
          <p className="text-caption text-muted-foreground">{TUR_ACIKLAMA[tur]}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mk-tarih">Tarih</Label>
          <Input id="mk-tarih" name="tarih" type="date" defaultValue={gunAnahtari()} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mk-irsaliye">İrsaliye / kargo no</Label>
          <Input id="mk-irsaliye" name="irsaliyeNo" placeholder="İsteğe bağlı" autoComplete="off" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Kalemler</Label>
          <span className="tabular text-caption text-muted-foreground">
            {satirlar.filter((r) => r.barkod.trim()).length} satır · {toplam} adet
          </span>
        </div>
        <div className="space-y-1.5">
          {satirlar.map((r, i) => (
            <div key={r.key} className="flex items-center gap-2">
              <Input
                ref={(el) => {
                  if (el) girisler.current.set(r.key, el);
                  else girisler.current.delete(r.key);
                }}
                value={r.barkod}
                onChange={(e) => guncelle(r.key, "barkod", e.target.value)}
                onKeyDown={(e) => {
                  // Barkod okuyucu Enter yollar: form gönderilmesin, sonraki satıra geç.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === satirlar.length - 1) satirEkle();
                    else girisler.current.get(satirlar[i + 1]!.key)?.focus();
                  }
                }}
                placeholder="Barkod"
                autoComplete="off"
                inputMode="text"
                className="tabular flex-1"
                autoFocus={i === 0}
              />
              <Input
                value={r.adet}
                onChange={(e) => guncelle(r.key, "adet", e.target.value)}
                type="number"
                step={1}
                min={tur === "duzeltme" ? undefined : 1}
                aria-label="Adet"
                className="tabular w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Satırı sil"
                disabled={satirlar.length === 1}
                onClick={() => setSatirlar((s) => s.filter((x) => x.key !== r.key))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => satirEkle()}>
            <Plus aria-hidden="true" />
            Satır ekle
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setYapistirAcik((a) => !a)}>
            <ClipboardPaste aria-hidden="true" />
            {yapistirAcik ? "Yapıştırmayı gizle" : "Excel'den yapıştır"}
          </Button>
        </div>
        <textarea
          name="yapistir"
          rows={5}
          placeholder={"Her satır: barkod  adet\n8690001234567\t12\n8690007654321\t3"}
          className={cn(
            "tabular w-full rounded-[--radius-kontrol] border border-input bg-background px-3 py-2 text-callout placeholder:text-muted-foreground",
            !yapistirAcik && "hidden",
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mk-not">Not</Label>
        <Input id="mk-not" name="not" placeholder="İsteğe bağlı" autoComplete="off" />
      </div>

      {hata && (
        <p role="alert" className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hata}</span>
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <FormGonderButonu
          yukleniyorMetni="Kaydediliyor"
          className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Fişi kaydet
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function MalKabulEkleTetikleyici({ sirketler }: { sirketler: SirketSecenegi[] }) {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <Button onClick={() => setAcik(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Fiş ekle
      </Button>
      <FormKabugu acik={acik} onKapat={() => setAcik(false)} baslik="Mal kabul fişi">
        {acik && <MalKabulFormIcerigi sirketler={sirketler} onBasarili={() => setAcik(false)} />}
      </FormKabugu>
    </>
  );
}
