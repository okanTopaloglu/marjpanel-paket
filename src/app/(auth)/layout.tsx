import { Marka } from "@/components/marka/logo";
import { MamaAuraYazi } from "@/components/marka/mama-aura";

/**
 * GİRİŞ / KAYIT KABUĞU.
 * ---------------------------------------------------------------------------
 * ORTALANMIŞ TEK KART. Kimliğini doğrulamaya gelen kullanıcının önünde tek bir
 * iş vardır; yan sütunda tanıtım, demo bağlantısı ya da iletişim kutusu yoktur.
 * Telefonda ve masaüstünde AYNI sayfa görünür.
 *
 * KİMLİK: Kartın üstünde MAMA AURA kelime işareti — kullanıcı "doğru yerdeyim"
 * demeli. MarjPanel yalnız alt bilgide, altyapı notu olarak durur; iki marka
 * aynı ağırlıkta yan yana konursa ikisi de okunmaz.
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
          <div className="mb-7 flex flex-col items-center gap-2.5">
            <MamaAuraYazi yukseklik={30} oncelik />
            <span className="text-overline font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Paket paneli
            </span>
          </div>
          {children}
        </div>
      </main>

      <footer className="flex items-center justify-center gap-1.5 px-4 pb-6 text-center text-caption text-muted-foreground sm:px-6">
        <Marka boyut={14} className="opacity-80" />
        <span>MarjPanel Paket altyapısı · kargo paketi okutma ve sipariş takibi</span>
      </footer>
    </div>
  );
}
