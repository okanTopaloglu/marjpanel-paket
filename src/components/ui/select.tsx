import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Seçim kutusu - yerli `<select>`, `input.tsx` ile aynı yükseklik, kenar,
 * köşe ve odak halkası. Menüsü işletim sistemine bırakılır (kendi açılır
 * listesini çizmez): depo/masaüstü karışık kullanımda en güvenilir davranış
 * budur.
 */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-11 w-full appearance-none rounded-[--radius-kontrol] border border-input bg-card px-3 py-2 pr-9 text-base",
            "font-medium ring-offset-background",
            "transition-[border-color,box-shadow] duration-gecis ease-out",
            "[@media(hover:hover)and(pointer:fine)]:hover:border-muted-foreground/50",
            "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            "md:h-9 md:text-[0.875rem]",
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
