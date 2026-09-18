import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Rozet - satır içi durum etiketi. DESIGN.md "dolgu yok" kuralı: çerçeve ve
 * metin rengi taşır, dolu renk taşımaz (dolu renk satırda gürültü yapar ve
 * tablo taramasını bozar).
 */
const rozetVariants = cva(
  "inline-flex shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-full border bg-transparent px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
  {
    variants: {
      ton: {
        notr: "border-border text-muted-foreground",
        basari: "border-success/40 text-success",
        uyari: "border-warning/40 text-warning",
        hata: "border-destructive/40 text-destructive",
        bilgi: "border-info/40 text-info",
      },
    },
    defaultVariants: { ton: "notr" },
  },
);

export interface RozetProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof rozetVariants> {}

const Rozet = React.forwardRef<HTMLSpanElement, RozetProps>(
  ({ className, ton, ...props }, ref) => (
    <span ref={ref} className={cn(rozetVariants({ ton }), className)} {...props} />
  ),
);
Rozet.displayName = "Rozet";

/**
 * Pazaryeri kimlikleri - DESIGN.md "Pazaryeri kimlikleri". Rozet çerçevesi
 * ve metni marka rengini taşır, dolgu yok; renk `style` ile inline verilir
 * çünkü marka renkleri Tailwind paletinde tanımlı değildir (tek seferlik
 * kullanım, token'a değmez).
 */
const PAZARYERI_RENK: Record<string, string> = {
  trendyol: "#E85D2A",
  hepsiburada: "#E0862F",
  n11: "#7B3FA0",
  pazarama: "#1E6FD9",
  ptt: "#C8102E",
  amazon: "#1A1A1A",
  woocommerce: "#7F54B3",
};

const PAZARYERI_AD: Record<string, string> = {
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  n11: "N11",
  pazarama: "Pazarama",
  ptt: "PTT",
  amazon: "Amazon",
  woocommerce: "WooCommerce",
};

export function PazaryeriRozeti({
  platform,
  className,
}: {
  /** Pazaryeri anahtarı, örn. "trendyol". Büyük/küçük harf duyarsız. */
  platform: string;
  className?: string;
}) {
  const anahtar = platform.toLowerCase();
  const renk = PAZARYERI_RENK[anahtar];
  const ad = PAZARYERI_AD[anahtar] ?? platform;

  if (!renk) {
    return (
      <Rozet ton="notr" className={className}>
        {ad}
      </Rozet>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-full border bg-transparent px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
        className,
      )}
      style={{ borderColor: `${renk}66`, color: renk }}
    >
      {ad}
    </span>
  );
}

export { Rozet, rozetVariants };
