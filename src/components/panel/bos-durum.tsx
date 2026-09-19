import type { LucideIcon } from "lucide-react";
import { KiraciFiligran } from "@/components/marka/kiraci-markasi";
import { cn } from "@/lib/utils";

/**
 * Boş durum — ARAYÜZÜ ÖĞRETİR, "kayıt yok" demez.
 *
 * Bir liste boşsa kullanıcının aklında iki soru vardır: "bu ekran ne
 * gösterir" ve "buraya nasıl veri gelir". `aciklama` birincisini, `aksiyon`
 * ikincisini cevaplar. İkisi de yoksa boş durum yazmaya değmez, satır
 * hiç çizilmesin.
 *
 * İkon nane DEĞİL nötr tonda: boş liste bir hata ya da başarı değil, sadece
 * bir durum. Vurgu rengi eylemin (aksiyon düğmesinin) hakkı.
 *
 * Altta soluk marka filigranı: boş bir yüzey markanın en çok göründüğü
 * yerdir; içerik gelince satırların arasında kaybolur, yokken alanı sahiplenir.
 */
export function BosDurum({
  ikon: Ikon,
  baslik,
  aciklama,
  aksiyon,
  className,
}: {
  ikon: LucideIcon;
  baslik: React.ReactNode;
  aciklama?: React.ReactNode;
  aksiyon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Ikon className="h-5 w-5" />
      </span>

      <div className="space-y-1">
        <p className="text-headline text-foreground">{baslik}</p>
        {aciklama && (
          <p className="mx-auto max-w-[46ch] text-footnote text-muted-foreground">
            {aciklama}
          </p>
        )}
      </div>

      {aksiyon && <div className="pt-1">{aksiyon}</div>}

      <KiraciFiligran className="mt-3" />
    </div>
  );
}
