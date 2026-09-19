import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { MarkaSaglayici } from "@/components/marka/kiraci-markasi";
import { kiraciMarkasi } from "@/lib/kiraci/coz";
import { PLATFORM_ADI } from "@/lib/kiraci/tipler";

/**
 * METADATA HOST'A GÖRE: kiracı adresinde sekme başlığı, uygulama adı ve
 * ikon şirketindir; platform adresinde MarjPanel Paket. Manifest de aynı
 * host'tan dinamik döner (app/manifest.webmanifest/route.ts).
 */
export async function generateMetadata(): Promise<Metadata> {
  const marka = await kiraciMarkasi();
  const kiraci = marka.tur === "kiraci";
  const ad = kiraci ? `${marka.ad} Paket` : PLATFORM_ADI;
  const ikon = kiraci && marka.logoAcik ? marka.logoAcik : null;

  return {
    applicationName: ad,
    title: { default: ad, template: `%s | ${ad}` },
    description: kiraci
      ? `${marka.ad} depo paket okutma ve sipariş takibi — MarjPanel Paket altyapısı.`
      : "Depo paket okutma ve pazaryeri sipariş takibi.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      // Açık temada okunaklı kalması için opak durum çubuğu (theme-color ile aynı).
      statusBarStyle: "default",
      title: ad,
    },
    icons: ikon
      ? {
          icon: [{ url: ikon }],
          apple: [{ url: ikon }],
        }
      : {
          icon: [
            { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
          apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
        },
    formatDetection: { telephone: false },
    other: {
      // Android: adres çubuğu ve görev listesi rengi manifest'ten gelir; iOS için
      // ek olarak ana ekran kısayolu başlığı.
      "mobile-web-app-capable": "yes",
      // Chrome'un otomatik sayfa çevirisi DOM'u değiştirip React'i çökertiyor
      // ("removeChild of null") - panel Türkçe, çeviri kapatılır.
      google: "notranslate",
    },
  };
}

export const viewport: Viewport = {
  // Tek açık tema - kroma rengi de tek (bkz. DESIGN.md "Tema").
  themeColor: "#F5F7F6",
  width: "device-width",
  initialScale: 1,
  // Kullanıcı yakınlaştırabilsin (erişilebilirlik) ama iOS'ta input'a
  // odaklanınca otomatik zoom olmasın diye alanlar 16px'ten küçük değil.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

/**
 * TEK YAZI TİPİ: Manrope Variable (`font-sans`, gövdeye uygulanır).
 * `@fontsource-variable/manrope` paketinden gelir, `next/font/google`
 * kullanılmaz: derleme sırasında dışarıya istek gidilmez, Docker imajı
 * ağsız da derlenebilir.
 *
 * Marka kök layout'ta çözülür ve bağlamla iner; her kabuk `useMarka()` der.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const marka = await kiraciMarkasi();
  return (
    <html lang="tr" translate="no" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-body antialiased">
        <MarkaSaglayici marka={marka}>
          {children}
          <SwRegister />
          <InstallPrompt />
        </MarkaSaglayici>
      </body>
    </html>
  );
}
