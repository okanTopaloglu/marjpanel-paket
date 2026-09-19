"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImageOff, Package, Pencil, Search, Trash2 } from "lucide-react";
import { urunSil } from "@/server/actions/urunler";
import { goreliZaman } from "@/lib/format/tarih";
import { BosDurum } from "@/components/panel/bos-durum";
import { IslemlerMenusu, type IslemMaddesi } from "@/components/panel/islemler-menusu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { SayfaGezinme } from "@/components/tables/sayfa-gezinme";
import { Input } from "@/components/ui/input";
import { Kopyalanabilir } from "@/components/ui/kopyala";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UrunFormu } from "./urun-formu";
import type { UrunSatiri } from "@/lib/db/repos/urunler";

/**
 * ÜRÜN LİSTESİ.
 *
 * Arama ve sayfa URL'DE tutulur (`?arama=&sayfa=`): kullanıcı bulduğu satırı
 * ekip arkadaşına bağlantı olarak yollayabilsin, geri düğmesi listeyi
 * kaybetmesin. Sunucu bileşeni sorguyu ona göre kurar - istemcide filtreleme
 * yok, 5000 ürünlük katalog tarayıcıya inmez.
 */

/**
 * Gecikmeli arama kutusu.
 *
 * URL'e bağlı bir kutu her tuşta bir RSC turu tetikler ve yazarken sayfa
 * donmuş gibi görünür (aynı sorun `filtre-cubugu.tsx` içindeki `AramaGirisi`
 * notunda anlatılır). Kutu KENDİ yerel değerini anında gösterir; URL yazım
 * durduktan 350 ms sonra bir kez güncellenir, Enter beklemeden gönderir.
 *
 * `FiltreCubugu` burada kullanılmadı: bu ekranın filtresi yok, yalnız araması
 * var; o bileşen grup listesi boşken de mobilde çalışmayan bir "Filtrele"
 * düğmesi çizerdi.
 */
function AramaKutusu({
  deger,
  onChange,
}: {
  deger: string;
  onChange: (v: string) => void;
}) {
  const [yerel, setYerel] = useState(deger);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gonder = (v: string) => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = null;
    if (v !== deger) onChange(v);
  };

  // Dışarıdan gelen değer (geri düğmesi, bağlantı) bekleyen yazımı ezmesin.
  useEffect(() => {
    if (zamanlayici.current == null) setYerel(deger);
  }, [deger]);

  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    [],
  );

  return (
    <div className="relative max-w-sm">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={yerel}
        aria-label="Üründe ara"
        placeholder="Barkod, ürün adı ya da stok kodu"
        className="pl-8"
        onChange={(e) => {
          const v = e.target.value;
          setYerel(v);
          if (zamanlayici.current) clearTimeout(zamanlayici.current);
          zamanlayici.current = setTimeout(() => gonder(v), 350);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            gonder(yerel);
          }
        }}
        onBlur={() => {
          if (zamanlayici.current) gonder(yerel);
        }}
      />
    </div>
  );
}

/** Liste satırındaki küçük görsel; yüklenemezse nötr bir kutuya düşer. */
function Kucukgorsel({ url, ad }: { url: string | null; ad: string | null }) {
  const [hatali, setHatali] = useState(false);
  useEffect(() => setHatali(false), [url]);

  if (!url || hatali) {
    return (
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-kontrol] border border-border bg-muted text-muted-foreground"
      >
        <ImageOff className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Pazaryeri CDN'i; next/image için uzak alan adı beyaz listesi gerekirdi.
    <img
      src={url}
      alt={ad ?? ""}
      loading="lazy"
      onError={() => setHatali(true)}
      className="h-9 w-9 shrink-0 rounded-[--radius-kontrol] border border-border bg-card object-cover"
    />
  );
}

export function UrunListesi({
  satirlar,
  toplam,
  arama,
  sayfa,
  limit,
}: {
  satirlar: UrunSatiri[];
  toplam: number;
  arama: string;
  /** 0 tabanlı sayfa. */
  sayfa: number;
  limit: number;
}) {
  const router = useRouter();
  const [duzenlenen, setDuzenlenen] = useState<UrunSatiri | null>(null);
  const [silinecek, setSilinecek] = useState<UrunSatiri | null>(null);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sayfaSayisi = Math.max(1, Math.ceil(toplam / Math.max(1, limit)));

  /** URL'i tek yerden kurar; boş değerler adres çubuğunu kirletmez. */
  const gezin = (yeni: { arama?: string; sayfa?: number }) => {
    const p = new URLSearchParams();
    const a = yeni.arama ?? arama;
    const s = yeni.sayfa ?? 0;
    if (a.trim()) p.set("arama", a.trim());
    if (s > 0) p.set("sayfa", String(s + 1));
    const sorgu = p.toString();
    router.push(sorgu ? `/urunler?${sorgu}` : "/urunler");
  };

  return (
    <div className="space-y-4">
      {/* Arama değişince sayfa BAŞA döner: 7. sayfadayken arama yapıp boş
          ekran görmek, sonucu yok sanmaya en kısa yol. */}
      <AramaKutusu deger={arama} onChange={(d) => gezin({ arama: d, sayfa: 0 })} />

      {hataMesaji && (
        <p
          role="alert"
          className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hataMesaji}</span>
        </p>
      )}

      {satirlar.length === 0 ? (
        <BosDurum
          ikon={Package}
          baslik={arama ? "Aramanıza uyan ürün yok" : "Katalog henüz boş"}
          aciklama={
            arama
              ? "Barkodun tamamını değil bir bölümünü aramayı deneyin."
              : "Ürünleri Excel dosyasından aktarabilir, pazaryerinden çekebilir ya da tek tek ekleyebilirsiniz. Okutma ekranı ürün adını ve görselini buradan alır."
          }
        />
      ) : (
        <>
          <div className="rounded-[--radius] border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Görsel</TableHead>
                  <TableHead>Barkod</TableHead>
                  <TableHead>Ürün adı</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Stok kodu</TableHead>
                  <TableHead>Son senkron</TableHead>
                  <TableHead className="w-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {satirlar.map((u) => {
                  const maddeler: IslemMaddesi[] = [
                    {
                      key: "duzenle",
                      etiket: "Düzenle",
                      ikon: Pencil,
                      onSelect: () => setDuzenlenen(u),
                    },
                    {
                      key: "sil",
                      etiket: "Sil",
                      ikon: Trash2,
                      tehlikeli: true,
                      onSelect: () => setSilinecek(u),
                    },
                  ];

                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Kucukgorsel url={u.gorselUrl} ad={u.urunAdi} />
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap">
                        <Kopyalanabilir deger={u.barkod}>
                          <span>{u.barkod}</span>
                        </Kopyalanabilir>
                      </TableCell>
                      <TableCell className="max-w-[22rem]">
                        <span className="block truncate text-headline text-foreground">
                          {u.urunAdi ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-muted-foreground">
                        {u.marka ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-muted-foreground">
                        {u.kategori ?? "-"}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                        {u.stokKodu ?? "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {u.sonSenkron ? goreliZaman(u.sonSenkron) : "-"}
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="tabular text-footnote text-muted-foreground">
              {toplam} ürün
              {arama ? " (aramaya uyan)" : ""}
            </p>
            <SayfaGezinme
              sayfa={sayfa}
              sayfaSayisi={sayfaSayisi}
              onSayfa={(n) => gezin({ sayfa: n })}
            />
          </div>
        </>
      )}

      <UrunFormu
        acik={duzenlenen !== null}
        onKapat={() => setDuzenlenen(null)}
        urun={duzenlenen ?? undefined}
      />

      <OnayDiyalogu
        acik={silinecek !== null}
        baslik={`${silinecek?.urunAdi ?? silinecek?.barkod ?? ""} silinsin mi?`}
        aciklama="Ürün katalogdan kaldırılır; okutma ekranı bu barkod için ad ve görsel gösteremez. Bu işlem geri alınamaz."
        onaylaMetni="Sil"
        tehlikeli
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          if (!silinecek) return;
          const id = silinecek.id;
          setSilinecek(null);
          setHataMesaji(null);
          startTransition(async () => {
            const durum = await urunSil(id);
            if (!durum.ok) setHataMesaji(durum.mesaj ?? "Ürün silinemedi.");
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
