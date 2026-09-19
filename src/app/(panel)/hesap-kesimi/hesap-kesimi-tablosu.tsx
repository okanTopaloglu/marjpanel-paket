"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Calculator, FileCheck, Receipt, Settings2, XCircle } from "lucide-react";
import { kesimIptal, kesimKes, kesimTaslakOlustur, odemeKaydet } from "@/server/actions/finans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rozet } from "@/components/ui/rozet";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { gunAnahtari, gunAnahtariKaydir, tarih } from "@/lib/format/tarih";
import { para, sayi } from "@/lib/format/sayi";
import { donemAdi, kurustanTl, type TarifeTanimi } from "@/lib/finans/hesap";
import type { KesimSatiri } from "@/lib/db/repos/finans";
import type { EylemDurumu } from "@/server/actions/auth";

export interface KesimDonemSatiri {
  sirketId: string;
  sirketAd: string;
  paketSayisi: number;
  tarife: TarifeTanimi | null;
  kesim: KesimSatiri | null;
  bakiye: string;
  gecikmis: number;
}

export const DURUM_ROZETI: Record<string, { ad: string; ton: "notr" | "bilgi" | "basari" | "hata" | "uyari" }> = {
  taslak: { ad: "Taslak", ton: "notr" },
  kesildi: { ad: "Kesildi", ton: "bilgi" },
  odendi: { ad: "Ödendi", ton: "basari" },
  iptal: { ad: "İptal", ton: "hata" },
};

function donemSecenekleri(): string[] {
  const liste: string[] = [];
  const simdi = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(simdi.getUTCFullYear(), simdi.getUTCMonth() - i, 1));
    liste.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return liste;
}

function Durum({ durum }: { durum: EylemDurumu | undefined }) {
  if (!durum || durum.ok) return null;
  return (
    <p role="alert" className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{durum.mesaj}</span>
    </p>
  );
}

const GONDER =
  "press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90";

/** Taslak oluştur/yenile: ek hizmet adetleri + diğer kalemler. */
function TaslakFormu({ satir, donem, onBitti }: { satir: KesimDonemSatiri; donem: string; onBitti: () => void }) {
  const [durum, eylem] = useActionState(kesimTaslakOlustur, undefined);
  const [ek, setEk] = useState<Record<string, string>>({});
  const [diger, setDiger] = useState<{ aciklama: string; adet: string; birimFiyat: string }[]>([]);
  useEffect(() => {
    if (durum?.ok) onBitti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);
  const t = satir.tarife;

  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="sirketId" value={satir.sirketId} />
      <input type="hidden" name="donem" value={donem} />
      <input type="hidden" name="ekHizmetAdetleri" value={JSON.stringify(ek)} />
      <input type="hidden" name="digerKalemler" value={JSON.stringify(diger)} />

      <div className="rounded-[--radius-kontrol] border border-border bg-background p-3 text-footnote">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Dönem paket sayısı</span>
          <span className="tabular font-semibold">{sayi(satir.paketSayisi)}</span>
        </div>
        {t && (
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Tarife</span>
            <span className="tabular">
              {t.kademeTipi === "dilimli" ? "dilimli" : "toplam"} ·{" "}
              {t.kademeler.map((k) => `${k.ustSinir ?? "∞"}:${k.birimFiyat}₺`).join(" / ")} · KDV %{t.kdvOrani}
            </span>
          </div>
        )}
      </div>

      {t && t.ekHizmetler.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-footnote font-semibold text-foreground">Ek hizmet adetleri</legend>
          {t.ekHizmetler.map((h) => (
            <div key={h.kod} className="flex items-center gap-2">
              <Label htmlFor={`ek-${h.kod}`} className="flex-1 font-normal">
                {h.ad} <span className="tabular text-muted-foreground">({para(h.birimFiyat)})</span>
              </Label>
              <Input
                id={`ek-${h.kod}`}
                type="number"
                min={0}
                step={1}
                value={ek[h.kod] ?? ""}
                onChange={(e) => setEk((s) => ({ ...s, [h.kod]: e.target.value }))}
                placeholder="0"
                className="tabular w-28"
              />
            </div>
          ))}
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="text-footnote font-semibold text-foreground">Diğer kalemler</legend>
        {diger.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_6rem] gap-2">
            <Input value={d.aciklama} placeholder="Açıklama" onChange={(e) => setDiger((s) => s.map((x, j) => (j === i ? { ...x, aciklama: e.target.value } : x)))} />
            <Input value={d.adet} type="number" step="any" placeholder="Adet" className="tabular" onChange={(e) => setDiger((s) => s.map((x, j) => (j === i ? { ...x, adet: e.target.value } : x)))} />
            <Input value={d.birimFiyat} type="number" step="0.01" placeholder="Birim ₺" className="tabular" onChange={(e) => setDiger((s) => s.map((x, j) => (j === i ? { ...x, birimFiyat: e.target.value } : x)))} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setDiger((s) => [...s, { aciklama: "", adet: "1", birimFiyat: "" }])}>
          Kalem ekle
        </Button>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="kesim-not">Not</Label>
        <Input id="kesim-not" name="not" placeholder="Faturada görünmez; iç not" />
      </div>

      <Durum durum={durum} />
      <div className="flex justify-end">
        <FormGonderButonu yukleniyorMetni="Hesaplanıyor" className={GONDER}>
          {satir.kesim?.durum === "taslak" ? "Taslağı yeniden hesapla" : "Taslak oluştur"}
        </FormGonderButonu>
      </div>
    </form>
  );
}

function KesFormu({ kesim, onBitti }: { kesim: KesimSatiri; onBitti: () => void }) {
  const [durum, eylem] = useActionState(kesimKes, undefined);
  useEffect(() => {
    if (durum?.ok) onBitti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);
  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="id" value={kesim.id} />
      <div className="rounded-[--radius-kontrol] border border-border bg-background p-3 text-footnote">
        <div className="flex justify-between"><span className="text-muted-foreground">Ara toplam</span><span className="tabular">{para(kesim.araToplam)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">KDV %{Number(kesim.kdvOrani)}</span><span className="tabular">{para(kesim.kdvTutari)}</span></div>
        <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Genel toplam</span><span className="tabular">{para(kesim.genelToplam)}</span></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kes-fatura">Fatura no</Label>
          <Input id="kes-fatura" name="faturaNo" placeholder="İsteğe bağlı" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kes-vade">Vade tarihi</Label>
          <Input id="kes-vade" name="vadeTarihi" type="date" defaultValue={gunAnahtariKaydir(gunAnahtari(), 14)} required />
        </div>
      </div>
      <Durum durum={durum} />
      <div className="flex justify-end">
        <FormGonderButonu yukleniyorMetni="Kesiliyor" className={GONDER}>
          Hesabı kes
        </FormGonderButonu>
      </div>
    </form>
  );
}

function OdemeFormu({ satir, onBitti }: { satir: KesimDonemSatiri; onBitti: () => void }) {
  const [durum, eylem] = useActionState(odemeKaydet, undefined);
  useEffect(() => {
    if (durum?.ok) onBitti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);
  const k = satir.kesim;
  const kalan = k ? Number(k.genelToplam) - Number(k.odenen) : 0;
  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="sirketId" value={satir.sirketId} />
      <input type="hidden" name="kesimId" value={k && k.durum === "kesildi" ? k.id : ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="od-tutar">Tutar (₺)</Label>
          <Input id="od-tutar" name="tutar" type="number" step="0.01" min="0.01" defaultValue={kalan > 0 ? kalan.toFixed(2) : ""} required className="tabular" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="od-tarih">Tarih</Label>
          <Input id="od-tarih" name="tarih" type="date" defaultValue={gunAnahtari()} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="od-yontem">Yöntem</Label>
          <Select id="od-yontem" name="yontem" defaultValue="havale">
            <option value="havale">Havale / EFT</option>
            <option value="nakit">Nakit</option>
            <option value="kredi_karti">Kredi kartı</option>
            <option value="diger">Diğer</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="od-not">Not</Label>
          <Input id="od-not" name="not" placeholder="Dekont no vb." />
        </div>
      </div>
      <p className="text-caption text-muted-foreground">
        {k && k.durum === "kesildi" ? `${donemAdi(k.donem)} kesimine bağlanır; tutar karşılandığında kesim "ödendi" olur.` : "Kesime bağlı olmayan ödeme (avans/bakiye)."}
      </p>
      <Durum durum={durum} />
      <div className="flex justify-end">
        <FormGonderButonu yukleniyorMetni="Kaydediliyor" className={GONDER}>
          Ödemeyi kaydet
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function HesapKesimiTablosu({ donem, satirlar }: { donem: string; satirlar: KesimDonemSatiri[] }) {
  const router = useRouter();
  const yol = usePathname();
  const [acik, setAcik] = useState<{ tur: "taslak" | "kes" | "odeme"; satir: KesimDonemSatiri } | null>(null);
  const [iptal, setIptal] = useState<KesimDonemSatiri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [, basla] = useTransition();

  const kapat = () => {
    setAcik(null);
    router.refresh();
  };

  const toplamKesilen = satirlar.reduce((t, s) => t + (s.kesim && s.kesim.durum !== "iptal" ? Number(s.kesim.genelToplam) : 0), 0);
  const toplamBakiye = satirlar.reduce((t, s) => t + Number(s.bakiye), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="donem" className="text-footnote">Dönem</Label>
          <Select id="donem" value={donem} onChange={(e) => router.push(`${yol}?donem=${e.target.value}`)} className="w-44">
            {donemSecenekleri().map((d) => (
              <option key={d} value={d}>
                {donemAdi(d)}
              </option>
            ))}
          </Select>
        </div>
        <div className="tabular text-footnote text-muted-foreground">
          Bu dönem kesilen <span className="font-semibold text-foreground">{para(toplamKesilen)}</span> · Toplam bakiye{" "}
          <span className="font-semibold text-foreground">{para(toplamBakiye)}</span>
        </div>
      </div>

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
              <TableHead>Şirket</TableHead>
              <TableHead className="text-right">Paket</TableHead>
              <TableHead>Tarife</TableHead>
              <TableHead>Kesim</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead className="text-right">Bakiye</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map((s) => {
              const k = s.kesim;
              const r = k ? DURUM_ROZETI[k.durum] : null;
              return (
                <TableRow key={s.sirketId}>
                  <TableCell className="font-semibold">{s.sirketAd}</TableCell>
                  <TableCell className="tabular text-right">{sayi(s.paketSayisi)}</TableCell>
                  <TableCell>
                    {s.tarife ? (
                      <span className="tabular text-footnote text-muted-foreground">
                        {s.tarife.kademeler.map((x) => `${x.ustSinir ?? "∞"}:${kurustanTl(Math.round(x.birimFiyat * 100))}₺`).join(" / ")}
                      </span>
                    ) : (
                      <Rozet ton="uyari">Tarife yok</Rozet>
                    )}
                    <Link href={`/hesap-kesimi/tarife?sirket=${s.sirketId}`} className="ml-2 inline-flex items-center gap-1 text-caption text-[hsl(var(--vurgu-metin))] underline-offset-2 hover:underline">
                      <Settings2 className="h-3 w-3" aria-hidden="true" />
                      düzenle
                    </Link>
                  </TableCell>
                  <TableCell>
                    {k && r ? (
                      <Link href={`/hesap-kesimi/${k.id}`} className="inline-flex items-center gap-2">
                        <Rozet ton={r.ton}>{r.ad}</Rozet>
                        {k.faturaNo && <span className="tabular text-caption text-muted-foreground">{k.faturaNo}</span>}
                        {k.durum === "kesildi" && k.vadeTarihi && <span className="tabular text-caption text-muted-foreground">vade {tarih(k.vadeTarihi)}</span>}
                      </Link>
                    ) : (
                      <span className="text-caption text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">{k && k.durum !== "iptal" ? para(k.genelToplam) : "—"}</TableCell>
                  <TableCell className="tabular text-right">
                    <span className={Number(s.bakiye) > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>{para(s.bakiye)}</span>
                    {s.gecikmis > 0 && <span className="ml-1 text-caption text-destructive">· {s.gecikmis} gecikmiş</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-nowrap gap-1">
                      {(!k || k.durum === "taslak" || k.durum === "iptal") && (
                        <Button type="button" variant="outline" size="sm" disabled={!s.tarife} title={s.tarife ? undefined : "Önce tarife tanımlayın"} onClick={() => setAcik({ tur: "taslak", satir: s })}>
                          <Calculator aria-hidden="true" />
                          {k?.durum === "taslak" ? "Yenile" : "Taslak"}
                        </Button>
                      )}
                      {k?.durum === "taslak" && (
                        <Button type="button" variant="ink" size="sm" onClick={() => setAcik({ tur: "kes", satir: s })}>
                          <FileCheck aria-hidden="true" />
                          Kes
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => setAcik({ tur: "odeme", satir: s })}>
                        <Receipt aria-hidden="true" />
                        Ödeme
                      </Button>
                      {k && (k.durum === "taslak" || k.durum === "kesildi") && (
                        <Button type="button" variant="ghost" size="sm" aria-label="İptal" onClick={() => setIptal(s)}>
                          <XCircle aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <FormKabugu
        acik={!!acik}
        onKapat={() => setAcik(null)}
        baslik={
          acik
            ? `${acik.satir.sirketAd} · ${donemAdi(donem)} · ${acik.tur === "taslak" ? "Taslak" : acik.tur === "kes" ? "Hesabı kes" : "Ödeme"}`
            : ""
        }
      >
        {acik?.tur === "taslak" && <TaslakFormu satir={acik.satir} donem={donem} onBitti={kapat} />}
        {acik?.tur === "kes" && acik.satir.kesim && <KesFormu kesim={acik.satir.kesim} onBitti={kapat} />}
        {acik?.tur === "odeme" && <OdemeFormu satir={acik.satir} onBitti={kapat} />}
      </FormKabugu>

      <OnayDiyalogu
        acik={!!iptal}
        tehlikeli
        baslik={iptal?.kesim?.durum === "taslak" ? "Taslak silinsin mi?" : "Kesim iptal edilsin mi?"}
        aciklama={iptal ? `${iptal.sirketAd} · ${donemAdi(donem)}. ${iptal.kesim?.durum === "kesildi" ? "Kesilmiş kesim iptal olarak işaretlenir, bakiyeden düşer." : "Taslak tamamen silinir."}` : undefined}
        onaylaMetni={iptal?.kesim?.durum === "taslak" ? "Sil" : "İptal et"}
        onKapat={() => setIptal(null)}
        onOnay={() => {
          const h = iptal;
          setIptal(null);
          if (!h?.kesim) return;
          basla(async () => {
            const d = await kesimIptal(h.kesim!.id);
            if (!d.ok) setHata(d.mesaj ?? "İşlem yapılamadı.");
            else router.refresh();
          });
        }}
      />
    </div>
  );
}
