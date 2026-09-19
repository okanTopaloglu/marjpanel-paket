import { AltyapiNotu, KiraciLogo } from "@/components/marka/kiraci-markasi";
import { kiraciMarkasi } from "@/lib/kiraci/coz";

/**
 * GİRİŞ / KAYIT KABUĞU.
 * ---------------------------------------------------------------------------
 * ORTALANMIŞ TEK KART. Kimliğini doğrulamaya gelen kullanıcının önünde tek bir
 * iş vardır; yan sütunda tanıtım, demo bağlantısı ya da iletişim kutusu yoktur.
 * Telefonda ve masaüstünde AYNI sayfa görünür.
 *
 * KİMLİK HOST'TAN GELİR (`kiraciMarkasi`): kiracı adresinde kartın üstünde
 * şirketin logosu, altında belirgin bir "altyapı: MarjPanel Paket" kilidi —
 * kullanıcı "doğru yerdeyim" der, MarjPanel de görünür kalır. Platform
 * adresinde yalnız MarjPanel.
 *
 * Zemin düz `--background`; gradyan, cam efekti, parlama yok. Kabuk bir SUNUCU
 * bileşenidir — istemci JavaScript'i yalnız form yapraklarında yaşar.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const marka = await kiraciMarkasi();
  const kiraci = marka.tur === "kiraci";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        {/* Mobilde tam genişlik (yalnız kabuğun kenar boşluğu kadar içeride),
            masaüstünde sabit ve ortalı. */}
        <div className="animate-in w-full max-w-[24rem]">
          <div className="mb-7 flex flex-col items-center gap-2.5">
            <KiraciLogo yukseklik={kiraci ? 34 : 28} altAd={kiraci ? undefined : "Paket"} oncelik />
            <span className="text-overline font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Paket paneli
            </span>
          </div>
          {children}
          {kiraci && (
            <div className="mt-8 flex justify-center">
              <AltyapiNotu belirgin />
            </div>
          )}
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-caption text-muted-foreground sm:px-6">
        MarjPanel Paket · kargo paketi okutma ve sipariş takibi
      </footer>
    </div>
  );
}
