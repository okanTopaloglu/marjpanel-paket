import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Düğme — tepki BASILDIĞI anda gelir, bırakmada değil (`:active` üzerinde).
 *
 * Dolgular düz: gradyan, iç ışık ve parlama yok. Yükseklik farkı köşe ve
 * dolguyla değil, TON ile kurulur — nane birincil eylem, mürekkep ikincil
 * ağırlıklı eylem, kalanlar çizgi ve zemin.
 */
const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[--radius-kontrol] font-semibold leading-none tracking-[-0.005em]",
    // `all` YOK: yalnız boyanan özellikler + basış ölçeği.
    "transition-[transform,background-color,color,border-color] duration-dokunma ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45",
    "cursor-pointer active:scale-[0.97]",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Birincil eylem — nane dolgu, beyaz metin (4,86:1, AA). */
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        /** Mürekkep dolgu — sayfanın ikinci ağırlıklı eylemi. */
        ink: "bg-ink text-ink-foreground hover:bg-ink-aktif",
        outline:
          "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline",

        /* --- Eski adlar: yeni varyantlara düşer ---------------------------
           `cta`/`secondary`/`subtle` panelde onlarca yerde geçiyor. Tek
           vurgu kuralı gereği ayrı renkleri yok; adları korunur ki sayfalar
           bu fazda dokunulmadan geçsin. */
        cta: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-ink text-ink-foreground hover:bg-ink-aktif",
        subtle: "bg-muted text-foreground hover:bg-border",
      },
      size: {
        sm: "h-8 px-2.5 text-[0.8125rem]",
        md: "h-9 px-3.5 text-[0.875rem]",
        lg: "h-11 px-6 text-[0.9375rem]",
        icon: "h-9 w-9",
        /** Eski adlar. */
        default: "h-9 px-3.5 text-[0.875rem]",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
