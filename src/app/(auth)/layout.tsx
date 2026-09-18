import { MarkaKilit } from "@/components/marka/logo";

/**
 * GİRİŞ / KAYIT KABUĞU.
 * ---------------------------------------------------------------------------
 * ORTALANMIŞ TEK KART. Kimliğini doğrulamaya gelen kullanıcının önünde tek bir
 * iş vardır; yan sütunda tanıtım, demo bağlantısı ya da iletişim kutusu yoktur.
 * Telefonda ve masaüstünde AYNI sayfa görünür.
 *
 * Zemin düz `--background`; gradyan, cam efekti, parlama yok. Kabuk bir SUNUCU
 * bileşenidir — istemci JavaScript'i yalnız form yapraklarında yaşar.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        {/* Mobilde tam genişlik (yalnız kabuğun kenar boşluğu kadar içeride),
            masaüstünde sabit ve ortalı. */}
        <div className="animate-in w-full max-w-[24rem]">
          <div className="mb-7 flex justify-center">
            <MarkaKilit boyut={36} yaziClass="text-title-2 text-foreground" altAd="Paket" />
          </div>
          {children}
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-caption text-muted-foreground sm:px-6">
        MarjPanel Paket - kargo paketi okutma ve sipariş takip paneli
      </footer>
    </div>
  );
}
