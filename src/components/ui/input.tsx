import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Metin alanı — mobilde 16px taban (iOS odaklanınca sayfayı yakınlaştırmasın),
 * masaüstünde 14px. Odakta nane halka; hover'da kenar bir ton koyulaşır.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[--radius-kontrol] border border-input bg-card px-3 py-2 text-base",
          "font-medium ring-offset-background",
          "transition-[border-color,box-shadow] duration-gecis ease-out",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Yer tutucu da AA eşiğini geçer: /65 opaklık 3,2:1'e düşüyordu.
          "placeholder:text-muted-foreground",
          "[@media(hover:hover)and(pointer:fine)]:hover:border-muted-foreground/50",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          "md:h-9 md:text-[0.875rem]",
          // Sayı alanı sağa hizalı ve hizalı rakamlı — para sütunu gibi okunur.
          type === "number" && "tabular text-right",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
