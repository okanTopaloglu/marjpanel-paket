"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Değerin yanında beliren kopyalama düğmesi. Sipariş no, kargo takip no,
 * barkod gibi kimlik alanlarının yanına konur; üzerine gelince görünür.
 */
export function Kopyala({
  deger,
  className,
}: {
  deger: string;
  className?: string;
}) {
  const [kopyalandi, setKopyalandi] = useState(false);

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
        await navigator.clipboard.writeText(deger);
          setKopyalandi(true);
          setTimeout(() => setKopyalandi(false), 1200);
        } catch {
          // Pano izni yok — sessiz geç.
        }
      }}
      title={`Kopyala: ${deger}`}
      aria-label={`${deger} değerini kopyala`}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm",
        "text-muted-foreground transition-opacity duration-dokunma ease-out",
        // Dokunmatikte hover yok: orada düğme HEP görünür kalır, yoksa
        // kopyalama telefonda erişilemez bir özellik olur.
        "[@media(hover:hover)and(pointer:fine)]:opacity-0",
        "[@media(hover:hover)and(pointer:fine)]:group-hover/kopya:opacity-100",
        "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
        "[@media(hover:hover)and(pointer:fine)]:hover:text-foreground",
        "focus-visible:opacity-100",
        kopyalandi && "!opacity-100",
        className,
      )}
    >
      {kopyalandi ? (
        <Check className="h-3 w-3 text-[hsl(var(--vurgu-parlak))]" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );
}

/** Değer + kopyala düğmesini birlikte saran yardımcı (hover grubu kurar). */
export function Kopyalanabilir({
  deger,
  children,
  className,
}: {
  deger: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/kopya inline-flex items-center gap-1", className)}>
      {children}
      <Kopyala deger={deger} />
    </span>
  );
}
