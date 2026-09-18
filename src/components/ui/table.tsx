import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tablo — panelin en yoğun yüzeyi (DENSITY 6).
 *
 * Başlık: 11px büyük harf, .06em harf aralığı, ikincil metin.
 * Satır: 1px çizgi, hover'da zemin `#F5F7F6`.
 * Mobilde yatay kaydırma momentumlu ve sayfayı kilitlemez.
 */
const Table = React.forwardRef<HTMLTableElement, React.ComponentProps<"table">>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-callout", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"thead">
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"tbody">
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border transition-colors duration-dokunma ease-out",
        // Hover zemini SAYFA zemini: satır "kalkmaz", yalnız işaretlenir.
        // Seçili satır nane soluk zemin — hover'dan ayrı okunur.
        "[@media(hover:hover)and(pointer:fine)]:hover:bg-background",
        "data-[state=selected]:bg-accent",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"th">>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        // Kompakt: h-8 (kullanıcı isteği: "her şey göz önünde").
        // Tam tonlu muted-foreground — /85 opaklık 11px büyük harfte AA'nın
        // altına düşüyordu.
        "h-8 px-2.5 text-left align-middle text-overline text-muted-foreground",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"td">>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      // Kompakt geçişi: py-2.5 → py-1.5 (satır başına ~10px kazanç; 1366×768
      // ekranda ürünler listesi kaydırmadan ~2 kat satır gösterir).
      className={cn("px-2.5 py-1.5 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
