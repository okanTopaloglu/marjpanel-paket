import { cn } from "@/lib/utils";

const BOYUTLAR = {
  sm: "h-7 w-7 text-caption",
  md: "h-8 w-8 text-caption",
  lg: "h-11 w-11 text-headline",
} as const;

/**
 * Kullanıcı avatarı — yüklenmiş bir profil görseli varsa `/g/<dosya>`
 * üzerinden servis edilir, yoksa adın baş harfi mürekkep zeminde gösterilir.
 *
 * Baş harf mürekkep zeminde: nane dolgu birincil EYLEM rengidir, kimlik
 * göstergesi değil (bkz. `topbar.tsx`, marjpanel).
 */
export function Avatar({
  ad,
  profilGorsel,
  boyut = "md",
  className,
}: {
  /** Baş harf buradan türetilir. */
  ad: string;
  /** `/g/[dosya]` route'unun servis ettiği dosya adı; yoksa baş harf gösterilir. */
  profilGorsel?: string | null;
  boyut?: keyof typeof BOYUTLAR;
  className?: string;
}) {
  const harf = (ad || "?").trim().charAt(0).toUpperCase() || "?";

  if (profilGorsel) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- /g/[dosya] kullanıcı yüklemesi, next/image optimizasyonu gerekmez.
      <img
        src={`/g/${profilGorsel}`}
        alt=""
        className={cn(
          "shrink-0 rounded-lg object-cover",
          BOYUTLAR[boyut].split(" ").slice(0, 2).join(" "),
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-ink font-semibold text-ink-foreground",
        BOYUTLAR[boyut],
        className,
      )}
    >
      {harf}
    </div>
  );
}
