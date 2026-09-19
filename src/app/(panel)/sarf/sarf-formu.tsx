"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { sarfHareketKaydet, sarfKaydet } from "@/server/actions/sarf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import { gunAnahtari } from "@/lib/format/tarih";
import type { SarfSatiri } from "@/lib/db/repos/sarf";
import type { EylemDurumu } from "@/server/actions/auth";

const GONDER =
  "press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90";

function Hata({ durum }: { durum: EylemDurumu | undefined }) {
  if (!durum || durum.ok) return null;
  return (
    <p role="alert" className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{durum.mesaj}</span>
    </p>
  );
}

export function SarfFormu({ sarf, onBitti }: { sarf?: SarfSatiri; onBitti: () => void }) {
  const [durum, eylem] = useActionState(sarfKaydet, undefined);
  useEffect(() => {
    if (durum?.ok) onBitti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);
  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="id" value={sarf?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sf-ad">Ad</Label>
          <Input id="sf-ad" name="ad" defaultValue={sarf?.ad ?? ""} placeholder="Koli 30x20x15" required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-birim">Birim</Label>
          <Input id="sf-birim" name="birim" defaultValue={sarf?.birim ?? "adet"} placeholder="adet / m / rulo" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-maliyet">Birim maliyet (₺)</Label>
          <Input id="sf-maliyet" name="birimMaliyet" type="number" step="0.0001" min={0} defaultValue={sarf ? Number(sarf.birimMaliyet) : ""} className="tabular" />
          <p className="text-caption text-muted-foreground">Tutarlı alım girildiğinde otomatik güncellenir.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-norm">Paket başı norm</Label>
          <Input id="sf-norm" name="paketBasiNorm" type="number" step="0.0001" min={0} defaultValue={sarf ? Number(sarf.paketBasiNorm) : ""} className="tabular" required />
          <p className="text-caption text-muted-foreground">Her paket bu kadar tüketir (koli 1, bant 0,3 m, patpat 0,5 m).</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-normb">Norm başlangıcı</Label>
          <Input id="sf-normb" name="normBaslangic" type="date" defaultValue={sarf?.normBaslangic ?? gunAnahtari()} required />
          <p className="text-caption text-muted-foreground">Bu tarihten sonraki paketler tüketime sayılır.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-kritik">Kritik seviye</Label>
          <Input id="sf-kritik" name="kritikSeviye" type="number" step="0.01" min={0} defaultValue={sarf ? Number(sarf.kritikSeviye) : ""} className="tabular" />
        </div>
        <label className="flex min-h-touch cursor-pointer items-center gap-2.5 text-callout font-medium sm:col-span-2">
          <input type="checkbox" name="aktif" defaultChecked={sarf?.aktif ?? true} className="h-4 w-4 accent-[hsl(var(--vurgu-parlak))]" />
          Aktif (tüketim ve gider hesabına dâhil)
        </label>
      </div>
      <Hata durum={durum} />
      <div className="flex justify-end">
        <FormGonderButonu yukleniyorMetni="Kaydediliyor" className={GONDER}>
          {sarf ? "Kaydet" : "Ekle"}
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function HareketFormu({ sarf, onBitti }: { sarf: SarfSatiri; onBitti: () => void }) {
  const [durum, eylem] = useActionState(sarfHareketKaydet, undefined);
  const [tur, setTur] = useState<"alim" | "sayim" | "duzeltme">("alim");
  useEffect(() => {
    if (durum?.ok) onBitti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);
  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="sarfId" value={sarf.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hr-tur">Hareket</Label>
          <Select id="hr-tur" name="tur" value={tur} onChange={(e) => setTur(e.target.value as typeof tur)}>
            <option value="alim">Alım (+)</option>
            <option value="sayim">Sayım (stoğu eşitle)</option>
            <option value="duzeltme">Düzeltme (±)</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr-miktar">{tur === "sayim" ? `Sayılan (${sarf.birim})` : `Miktar (${sarf.birim})`}</Label>
          <Input id="hr-miktar" name="miktar" type="number" step="0.01" defaultValue={tur === "sayim" ? sarf.stok : ""} required className="tabular" />
          {tur === "sayim" && <p className="text-caption text-muted-foreground">Hesaplanan stok {sarf.stok}; fark hareket olarak yazılır.</p>}
        </div>
        {tur === "alim" && (
          <div className="space-y-1.5">
            <Label htmlFor="hr-tutar">Toplam tutar (₺)</Label>
            <Input id="hr-tutar" name="tutar" type="number" step="0.01" min={0} className="tabular" placeholder="İsteğe bağlı" />
            <p className="text-caption text-muted-foreground">Girilirse birim maliyet güncellenir.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="hr-tarih">Tarih</Label>
          <Input id="hr-tarih" name="tarih" type="date" defaultValue={gunAnahtari()} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="hr-not">Not</Label>
          <Input id="hr-not" name="not" placeholder="Tedarikçi, fatura no…" />
        </div>
      </div>
      <Hata durum={durum} />
      <div className="flex justify-end">
        <FormGonderButonu yukleniyorMetni="Kaydediliyor" className={GONDER}>
          Kaydet
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function SarfEkleTetikleyici() {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <Button onClick={() => setAcik(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Malzeme ekle
      </Button>
      <FormKabugu acik={acik} onKapat={() => setAcik(false)} baslik="Sarf malzemesi">
        {acik && <SarfFormu onBitti={() => setAcik(false)} />}
      </FormKabugu>
    </>
  );
}
