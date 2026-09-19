import Link from "next/link";
import { ClipboardList, ScanBarcode, Zap, type LucideIcon } from "lucide-react";
import type { OkutmaModu } from "@/lib/db/schema";
import { Rozet } from "@/components/ui/rozet";
import { cn } from "@/lib/utils";

/**
 * MOD SEÇİMİ — okutma ekranının ilk adımı. Üç büyük kart; varsayılan mod
 * "Öneriliyor" rozetiyle işaretlidir ama herkes her modu seçebilir
 * (vardiyada aynı kişi sabah hızlı, öğleden sonra toplama çalışabilir).
 */
const MODLAR: { mod: OkutmaModu; ad: string; aciklama: string; ikon: LucideIcon }[] = [
  { mod: "hizli", ad: "Hızlı Okutma", aciklama: "Barkod okutulur okutulmaz kaydedilir. En hızlı akış, ek bilgi göstermez.", ikon: Zap },
  { mod: "rehberli", ad: "Rehberli (İçerik Göster)", aciklama: "Okutulan paketin sipariş içeriği (ürün, adet, görsel) ekranda görünür.", ikon: ScanBarcode },
  { mod: "toplama", ad: "Toplama (Atamalı)", aciklama: "Kargo firmasına göre paket üstlenir, toplama listesiyle tek tek paketlersiniz.", ikon: ClipboardList },
];

export function ModSec({ varsayilan }: { varsayilan: OkutmaModu }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {MODLAR.map(({ mod, ad, aciklama, ikon: Ikon }) => {
        const onerili = mod === varsayilan;
        return (
          <Link
            key={mod}
            href={`/okut?mod=${mod}`}
            className={cn(
              "press flex min-h-[11rem] flex-col gap-3 rounded-[--radius] border bg-card p-5 shadow-soft",
              "transition-[border-color,background-color] duration-dokunma ease-out",
              "[@media(hover:hover)and(pointer:fine)]:hover:border-[hsl(var(--vurgu-parlak))] [@media(hover:hover)and(pointer:fine)]:hover:bg-accent",
              onerili ? "border-[hsl(var(--vurgu-parlak))]" : "border-border",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[hsl(var(--vurgu-parlak))]">
                <Ikon className="h-5 w-5" aria-hidden="true" />
              </span>
              {onerili && <Rozet ton="basari">Öneriliyor</Rozet>}
            </span>
            <span className="text-title-3">{ad}</span>
            <span className="text-footnote text-muted-foreground">{aciklama}</span>
          </Link>
        );
      })}
    </div>
  );
}
