import Link from "next/link";
import { Marka } from "@/components/marka/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
      <Marka boyut={56} className="mb-6" />
      <div className="grad-text text-display text-[clamp(3.5rem,12vw,5rem)]">404</div>
      <h1 className="mt-3 text-title-2 text-foreground">Sayfa bulunamadı</h1>
      <p className="mt-2 max-w-sm text-callout text-muted-foreground">
        Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-xl bg-grad-cta px-6 text-callout font-semibold text-cta-foreground shadow-soft transition-transform duration-150 ease-out active:scale-95"
      >
        Panele dön
      </Link>
    </main>
  );
}
