import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        // Tam tonlu foreground: /85 opaklık form etiketini gövdeden ayırmıyor,
        // yalnız soluklaştırıyordu. Ayrım BOYUT ve AĞIRLIKLA kurulur.
        "text-footnote font-semibold leading-none text-foreground",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
