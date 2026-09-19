"use client";

import { type RefObject } from "react";
import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AZAMI_BARKOD_UZUNLUGU } from "@/lib/okut/sonuc";
import { cn } from "@/lib/utils";

/**
 * BARKOD GİRİŞİ - ekranın tek işi.
 *
 * Alan HİÇBİR KOŞULDA pasifleşmez (`disabled` yok). El terminali saniyede
 * iki paket okutur; istek sürerken alanı kilitlemek okutmayı kaybetmek
 * demektir. Bunun yerine gönderim kuyruğa girer, alan hemen boşalır ve bir
 * sonraki barkodu beklemeye devam eder.
 *
 * Tarayıcıların bir kısmı satır sonu yerine SEKME gönderir; Tab da gönderim
 * sayılır, yoksa okutulan değer alanda kalır ve odak kaybolur.
 */
export function HizliMod({
  deger,
  onDeger,
  onGonder,
  girisRef,
  bekleyen,
  yan,
}: {
  deger: string;
  onDeger: (v: string) => void;
  onGonder: (barkod: string) => void;
  girisRef: RefObject<HTMLInputElement | null>;
  /** Sunucudan cevabı beklenen okutma sayısı - yalnız bilgi amaçlı. */
  bekleyen: number;
  /** Alanın sağında duran ek düğme (mobilde kamera). */
  yan?: React.ReactNode;
}) {
  const gonder = () => {
    const barkod = deger.trim();
    if (!barkod) return;
    onDeger("");
    onGonder(barkod);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        gonder();
      }}
      className="rounded-[--radius] border border-border bg-card p-4 sm:p-5"
    >
      <label
        htmlFor="barkod-alani"
        className="text-overline text-muted-foreground"
      >
        Kargo barkodu
      </label>

      <div className="mt-2 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <ScanBarcode
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="barkod-alani"
            ref={girisRef}
            value={deger}
            onChange={(e) => onDeger(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && deger.trim()) {
                e.preventDefault();
                gonder();
              }
            }}
            // Odak kaybolursa okutma kaybolur: alan açılışta odaklanır,
            // `useTarayiciOdak` da onu geri çeker.
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
            maxLength={AZAMI_BARKOD_UZUNLUGU}
            placeholder="Okutun ya da yazın"
            aria-label="Kargo barkodu"
            className={cn(
              "tabular h-14 w-full rounded-[--radius-kontrol] border border-input bg-card pl-11 pr-3",
              "text-2xl font-semibold text-foreground placeholder:text-base placeholder:font-medium placeholder:text-muted-foreground",
              "transition-[border-color,box-shadow] duration-gecis ease-out",
              "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
            )}
          />
        </div>

        {yan}

        <Button type="submit" size="lg" className="h-14 px-6 text-base">
          Okut
        </Button>
      </div>

      <p className="mt-2 text-footnote text-muted-foreground">
        {bekleyen > 0
          ? `${bekleyen} okutma kaydediliyor, okutmaya devam edebilirsiniz.`
          : "El terminali ya da klavye ile okutun; alan hep hazır bekler."}
      </p>
    </form>
  );
}
