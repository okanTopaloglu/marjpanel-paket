import type { Metadata } from "next";

/**
 * Yazdırma katmanı — kabuk yok (menü, üst çubuk, sekme çubuğu).
 *
 * Etiket/fiş gibi sayfalar burada yaşar: beyaz zemin, tam ekran, yalnız
 * yazdırılacak içerik. Panel arama motorlarına kapalı olduğu gibi bu katman
 * da kapalıdır — etiket sayfaları kişiye özel kargo/sipariş verisi taşır.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function YazdirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-white text-foreground print:min-h-0">
      {children}
    </div>
  );
}
