"use client";

import { RefreshCw, Truck } from "lucide-react";
import { BosDurum } from "@/components/panel/bos-durum";
import { Button } from "@/components/ui/button";
import type { KargoSecenegi } from "@/lib/db/repos/atama";
import { cn } from "@/lib/utils";

/**
 * TOPLAMA 1. ADIM - kargo firması seçimi.
 *
 * Firma seçmek bir FİLTRE değil bir TAAHHÜTTÜR: seçilen firmadan aynı
 * içerikli siparişlerden bir grup çalışanın üstüne yazılır. Bu yüzden
 * seçenekler büyük dokunma hedefleridir (≥44px) ve yanlarında havuzdaki
 * paket sayısı durur - kullanıcı en dolu firmayı görüp oradan başlar.
 */
export function KargoSec({
  firmalar,
  calisiyor,
  onSec,
  onYenile,
}: {
  firmalar: KargoSecenegi[];
  calisiyor: boolean;
  onSec: (kargoFirmasi: string) => void;
  onYenile: () => void;
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-title-3">Kargo firması seçin</h2>
          <p className="text-footnote text-muted-foreground">
            Size aynı içerikli siparişlerden bir paket grubu atanır.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onYenile}
          disabled={calisiyor}
          aria-label="Listeyi yenile"
        >
          <RefreshCw
            className={cn("h-4 w-4", calisiyor && "animate-spin")}
            aria-hidden="true"
          />
        </Button>
      </div>

      {firmalar.length === 0 ? (
        <BosDurum
          ikon={Truck}
          baslik="Bekleyen sipariş yok"
          aciklama="Havuzda hazırlanmayı bekleyen paket kalmadı. Yeni siparişler geldiğinde firmalar burada listelenir."
          aksiyon={
            <Button type="button" variant="outline" onClick={onYenile}>
              Yenile
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2 p-4 sm:grid-cols-2">
          {firmalar.map((f) => (
            <li key={f.kargoFirmasi}>
              <button
                type="button"
                onClick={() => onSec(f.kargoFirmasi)}
                disabled={calisiyor}
                className={cn(
                  "press flex min-h-touch w-full cursor-pointer items-center justify-between gap-3",
                  "rounded-[--radius-kontrol] border border-border bg-card px-4 py-3 text-left",
                  "transition-colors duration-dokunma ease-out",
                  "[@media(hover:hover)and(pointer:fine)]:hover:border-ring",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Truck
                    className="h-5 w-5 shrink-0 text-[hsl(var(--vurgu-metin))]"
                    aria-hidden="true"
                  />
                  <span className="truncate text-headline text-foreground">
                    {f.kargoFirmasi}
                  </span>
                </span>
                <span className="tabular shrink-0 text-callout text-muted-foreground">
                  {f.adet} paket
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
