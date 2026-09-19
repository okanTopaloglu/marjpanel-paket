"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { tarifeKaydetForm, tarifeSilEylemi } from "@/server/actions/finans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { gunAnahtari, tarih } from "@/lib/format/tarih";
import { para } from "@/lib/format/sayi";
import { ekHizmetleriDuzenle, kademeleriDuzenle } from "@/lib/finans/hesap";
import type { Tarife } from "@/lib/db/schema";

interface KademeSatiri {
  ustSinir: string;
  birimFiyat: string;
}
interface EkSatiri {
  kod: string;
  ad: string;
  birimFiyat: string;
}

export function TarifeFormu({ sirketId, sirketler, son }: { sirketId: string; sirketler: { id: string; ad: string }[]; son: Tarife | null }) {
  const router = useRouter();
  const [durum, eylem] = useActionState(tarifeKaydetForm, undefined);
  const [kademeler, setKademeler] = useState<KademeSatiri[]>(() =>
    son
      ? kademeleriDuzenle(son.kademeler).map((k) => ({ ustSinir: k.ustSinir === null ? "" : String(k.ustSinir), birimFiyat: String(k.birimFiyat) }))
      : [{ ustSinir: "", birimFiyat: "" }],
  );
  const [ek, setEk] = useState<EkSatiri[]>(() =>
    son ? ekHizmetleriDuzenle(son.ekHizmetler).map((h) => ({ kod: h.kod, ad: h.ad, birimFiyat: String(h.birimFiyat) })) : [],
  );

  useEffect(() => {
    if (durum?.ok) router.refresh();
  }, [durum, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{son ? "Yeni tarife sürümü" : "İlk tarife"}</CardTitle>
        <CardDescription>Kaydedilen her sürüm geçerlilik tarihinden itibaren uygulanır; önceki sürüm eski dönemler için saklanır.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={eylem} className="space-y-5">
          <input type="hidden" name="kademeler" value={JSON.stringify(kademeler)} />
          <input type="hidden" name="ekHizmetler" value={JSON.stringify(ek)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tf-sirket">Şirket</Label>
              <Select id="tf-sirket" name="sirketId" value={sirketId} onChange={(e) => router.push(`/hesap-kesimi/tarife?sirket=${e.target.value}`)}>
                {sirketler.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-tarih">Geçerlilik başlangıcı</Label>
              <Input id="tf-tarih" name="gecerlilikBaslangic" type="date" defaultValue={gunAnahtari().slice(0, 8) + "01"} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-tip">Kademe tipi</Label>
              <Select id="tf-tip" name="kademeTipi" defaultValue={son?.kademeTipi ?? "toplam"}>
                <option value="toplam">Toplam — adedin düştüğü kademe tüm paketlere</option>
                <option value="dilimli">Dilimli — her dilim kendi fiyatıyla</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-kdv">KDV oranı (%)</Label>
              <Input id="tf-kdv" name="kdvOrani" type="number" step="0.01" min={0} max={100} defaultValue={son ? Number(son.kdvOrani) : 20} required className="tabular" />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-footnote font-semibold text-foreground">Paket başı kademeler</legend>
            <p className="text-caption text-muted-foreground">Üst sınır: bu adede kadar (dâhil). Son kademenin üst sınırını boş bırakın (sınırsız).</p>
            {kademeler.map((k, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2">
                <Input value={k.ustSinir} type="number" min={1} step={1} placeholder={i === kademeler.length - 1 ? "∞ (boş)" : "Üst sınır (adet)"} className="tabular" onChange={(e) => setKademeler((s) => s.map((x, j) => (j === i ? { ...x, ustSinir: e.target.value } : x)))} />
                <Input value={k.birimFiyat} type="number" min={0} step="0.01" placeholder="Paket başı ₺" className="tabular" onChange={(e) => setKademeler((s) => s.map((x, j) => (j === i ? { ...x, birimFiyat: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Kademeyi sil" disabled={kademeler.length === 1} onClick={() => setKademeler((s) => s.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setKademeler((s) => [...s, { ustSinir: "", birimFiyat: "" }])}>
              <Plus aria-hidden="true" />
              Kademe ekle
            </Button>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-footnote font-semibold text-foreground">Ek hizmetler</legend>
            <p className="text-caption text-muted-foreground">Kesimde adedi girilen, paket ücretinden ayrı fiyatlanan kalemler (patpat, koli, etiket…).</p>
            {ek.map((h, i) => (
              <div key={i} className="grid grid-cols-[6rem_1fr_7rem_2.5rem] gap-2">
                <Input value={h.kod} placeholder="kod" className="tabular" onChange={(e) => setEk((s) => s.map((x, j) => (j === i ? { ...x, kod: e.target.value } : x)))} />
                <Input value={h.ad} placeholder="Ad (faturada görünür)" onChange={(e) => setEk((s) => s.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)))} />
                <Input value={h.birimFiyat} type="number" min={0} step="0.01" placeholder="Birim ₺" className="tabular" onChange={(e) => setEk((s) => s.map((x, j) => (j === i ? { ...x, birimFiyat: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Ek hizmeti sil" onClick={() => setEk((s) => s.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setEk((s) => [...s, { kod: "", ad: "", birimFiyat: "" }])}>
              <Plus aria-hidden="true" />
              Ek hizmet ekle
            </Button>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="tf-not">Not</Label>
            <Input id="tf-not" name="not" placeholder="İsteğe bağlı (örn. sözleşme no)" />
          </div>

          {durum && (
            <p role={durum.ok ? "status" : "alert"} className={`animate-fade flex items-start gap-1.5 text-footnote font-medium ${durum.ok ? "text-success" : "text-destructive"}`}>
              {durum.ok ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span>{durum.mesaj}</span>
            </p>
          )}

          <div className="flex justify-end">
            <FormGonderButonu yukleniyorMetni="Kaydediliyor" className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90">
              Tarifeyi kaydet
            </FormGonderButonu>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function TarifeGecmisi({ kayitlar }: { kayitlar: Tarife[] }) {
  const router = useRouter();
  const [, basla] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarife geçmişi</CardTitle>
        <CardDescription>En üstteki, bugün geçerli olan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {kayitlar.length === 0 && <p className="text-footnote text-muted-foreground">Henüz tarife yok.</p>}
        {kayitlar.map((t) => (
          <div key={t.id} className="rounded-[--radius-kontrol] border border-border p-3 text-footnote">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{tarih(t.gecerlilikBaslangic)} itibarıyla</span>
              <Button type="button" variant="ghost" size="icon" aria-label="Tarifeyi sil" onClick={() => basla(async () => { await tarifeSilEylemi(t.id); router.refresh(); })}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <div className="tabular mt-1 text-muted-foreground">
              {t.kademeTipi === "dilimli" ? "Dilimli" : "Toplam"} · {kademeleriDuzenle(t.kademeler).map((k) => `≤${k.ustSinir ?? "∞"}: ${para(k.birimFiyat)}`).join(" · ")} · KDV %{Number(t.kdvOrani)}
            </div>
            {ekHizmetleriDuzenle(t.ekHizmetler).length > 0 && (
              <div className="tabular mt-1 text-muted-foreground">Ek: {ekHizmetleriDuzenle(t.ekHizmetler).map((h) => `${h.ad} ${para(h.birimFiyat)}`).join(" · ")}</div>
            )}
            {t.not && <div className="mt-1 text-muted-foreground">{t.not}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
