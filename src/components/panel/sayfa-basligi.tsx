import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sayfa başlığı bloğu — panelin her sayfasının ilk satırı.
 *
 * Başlık ÜST ÇUBUKTA DEĞİL BURADA: üst çubuk kimliğe ve duruma ait, başlık
 * içeriğe. İkisini ayırmak her sayfanın kendi aksiyonlarını kabuğa taşımaya
 * çalışmasını da bitirir.
 *
 * `aciklama` tek cümledir ve MÜŞTERİ DİLİYLE yazılır: "bu sayfa ne işe
 * yarar" sorusunu satıcının kelimeleriyle cevaplar, alan adlarını
 * saymaz. Boş bırakılabilir — söyleyecek bir şey yoksa satır da olmasın.
 *
 * Mobilde aksiyonlar başlığın ALTINA, tam genişliğe iner: dar ekranda
 * başlıkla yan yana sıkışan düğmeler hem okunmaz hem 44px hedefin altına
 * düşerdi.
 */
export function SayfaBasligi({
  baslik,
  aciklama,
  aksiyonlar,
  geri,
  className,
}: {
  baslik: React.ReactNode;
  /** Tek cümle, müşteri diliyle. */
  aciklama?: React.ReactNode;
  /** Sağda duran düğmeler; mobilde altta tam genişlik. */
  aksiyonlar?: React.ReactNode;
  /** Geri bağlantısı — detay sayfalarında listeye döner. */
  geri?: { href: string; etiket: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      {geri && (
        <Link
          href={geri.href}
          className={cn(
            "press mb-2 inline-flex min-h-touch items-center gap-1 -ml-1 pr-2",
            "text-footnote font-medium text-muted-foreground",
            "transition-colors duration-dokunma ease-out",
            "[@media(hover:hover)and(pointer:fine)]:hover:text-foreground",
          )}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          {geri.etiket}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="page-title">{baslik}</h1>
          {aciklama && <p className="page-subtitle max-w-[70ch]">{aciklama}</p>}
        </div>

        {aksiyonlar && (
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center gap-2",
              // Mobil: tam genişlik, düğmeler satırı paylaşır.
              "[&>*]:flex-1 sm:[&>*]:flex-none",
            )}
          >
            {aksiyonlar}
          </div>
        )}
      </div>
    </div>
  );
}
