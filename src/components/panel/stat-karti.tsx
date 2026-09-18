import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Özet kartı — bir sayının tek başına durduğu kart. "Bugün okutulan",
 * "Bekleyen paket" gibi özet ekranı sayılarının standart yuvası.
 *
 * DESIGN.md "Yasaklar": dolgu rengi yok, tek vurgu rengi ikon ve sayıda
 * yaşar, kart kendisi düz beyaz yüzey. Sayı `tabular-nums` — kart yan yana
 * dururken rakamlar hizasız zıplamasın.
 */
export function StatKarti({
  etiket,
  deger,
  dipnot,
  ikon: Ikon,
  className,
}: {
  /** Kısa etiket, ör. "Bugün okutulan". */
  etiket: string;
  /** Büyük sayı; genelde önceden biçimlendirilmiş metin ya da sayı. */
  deger: React.ReactNode;
  /** Sayının altında tek satır ek bilgi, ör. "dün 128". */
  dipnot?: React.ReactNode;
  ikon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[--radius] border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-overline text-muted-foreground">{etiket}</div>
          <div className="tabular text-display leading-none text-foreground">
            {deger}
          </div>
          {dipnot && (
            <div className="text-footnote text-muted-foreground">{dipnot}</div>
          )}
        </div>
        {Ikon && (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-kontrol] bg-primary/10 text-[hsl(var(--vurgu-metin))]"
          >
            <Ikon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}
