"use client";

import { cn } from "@/lib/utils";

/**
 * Durum sekmeleri — sayfanın EN SIK kullanılan filtresi, çubuğun üstünde.
 *
 * Siparişlerde "Yeni / Gönderime Hazır / Taşımada" günde onlarca kez
 * değiştirilir; bunu `FiltreCubugu` panelinin içine gömmek her seferinde iki
 * tık demekti. Sık kullanılan tek-seçimli filtre açıkta kalır, geri kalanı
 * panele iner (bkz. FiltreCubugu başlığı).
 *
 * Sayaç ETİKETİN PARÇASI: "Yeni 12" tek bir hedef; kullanıcı sekmeye
 * bakmadan hangi kutuda iş olduğunu görür. Sıfır olan sekme gizlenmez -
 * yerinin sabit kalması tarama alışkanlığını korur.
 *
 * Mobilde yatay kaydırır ve kaydırma çubuğu gizlidir; seçili sekme
 * `scroll-snap` ile kenara oturur.
 */
export interface DurumSekmesi<T extends string> {
  key: T;
  etiket: string;
  adet?: number;
}

export function DurumSekmeleri<T extends string>({
  sekmeler,
  secili,
  onSecim,
  className,
  etiket = "Durum filtresi",
}: {
  sekmeler: readonly DurumSekmesi<T>[];
  secili: T;
  onSecim: (k: T) => void;
  className?: string;
  etiket?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiket}
      className={cn(
        "no-scrollbar snap-x-strip -mx-1 flex gap-1 overflow-x-auto px-1",
        className,
      )}
    >
      {sekmeler.map((s) => {
        const aktif = s.key === secili;
        return (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={aktif}
            onClick={() => onSecim(s.key)}
            className={cn(
              "press inline-flex min-h-touch shrink-0 snap-start items-center gap-1.5",
              "rounded-full border px-3.5 text-[0.8125rem] font-semibold",
              "transition-[background-color,color,border-color] duration-dokunma ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              aktif
                ? "border-primary bg-primary text-primary-foreground"
                : cn(
                    "border-border bg-card text-muted-foreground",
                    "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
                    "[@media(hover:hover)and(pointer:fine)]:hover:text-foreground",
                  ),
            )}
          >
            {s.etiket}
            {s.adet != null && (
              <span
                className={cn(
                  "tabular",
                  aktif ? "text-primary-foreground/75" : "text-muted-foreground/70",
                )}
              >
                {s.adet}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
