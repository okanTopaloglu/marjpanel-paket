"use client";

import { useState } from "react";
import { ArrowRight, Package, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import type { ToplamaKalemi } from "@/lib/atama/secim";

/**
 * TOPLAMA 2. ADIM - raftan toplanacak ürünler.
 *
 * Liste SİPARİŞ bazında değil ÜRÜN bazındadır: aynı ürün beş siparişte
 * geçiyorsa rafa beş kez gidilmez, tek satırda "5 adet" yazar. Toplama
 * modunun bütün kazancı buradadır.
 */
export function ToplamaListesi({
  kalemler,
  siparisSayisi,
  calisiyor,
  onPaketle,
  onBirak,
}: {
  kalemler: ToplamaKalemi[];
  siparisSayisi: number;
  calisiyor: boolean;
  onPaketle: () => void;
  onBirak: () => void;
}) {
  const [onayAcik, setOnayAcik] = useState(false);
  const toplamAdet = kalemler.reduce((t, k) => t + k.toplamAdet, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-[--radius] border border-border bg-card">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-title-3">Toplama listesi</h2>
            <p className="text-footnote text-muted-foreground">
              Aynı ürün birden çok siparişte olsa da tek satırda toplanır.
            </p>
          </div>
          <span className="tabular shrink-0 text-footnote text-muted-foreground">
            {siparisSayisi} sipariş / {toplamAdet} adet
          </span>
        </div>

        <ul className="divide-y divide-border">
          {kalemler.map((k) => (
            <li key={k.barkod} className="flex items-center gap-3 px-4 py-3">
              {k.gorselUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- pazaryeri görseli; next/image optimizasyonu gereksiz.
                <img
                  src={k.gorselUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-[--radius-kontrol] border border-border object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[--radius-kontrol] border border-border bg-muted text-muted-foreground">
                  <Package className="h-7 w-7" aria-hidden="true" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-callout text-foreground">
                  {k.urunAdi}
                </p>
                <p className="tabular text-caption text-muted-foreground">
                  {k.barkod}
                </p>
                <p className="text-caption text-muted-foreground">
                  {k.siparisSayisi} siparişte
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="tabular text-title-2 text-foreground">
                  {k.toplamAdet}
                </p>
                <p className="text-overline text-muted-foreground">adet</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="flex-1"
          onClick={onPaketle}
          disabled={calisiyor}
        >
          Topladım, paketlemeye başla
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => setOnayAcik(true)}
          disabled={calisiyor}
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Paketleri bırak
        </Button>
      </div>

      <OnayDiyalogu
        acik={onayAcik}
        baslik="Paketler havuza dönsün mü?"
        aciklama="Üstünüzdeki paketler serbest bırakılır ve başka çalışanlar alabilir."
        onaylaMetni="Bırak"
        tehlikeli
        onOnay={() => {
          setOnayAcik(false);
          onBirak();
        }}
        onKapat={() => setOnayAcik(false)}
      />
    </div>
  );
}
