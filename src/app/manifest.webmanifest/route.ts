import { kiraciMarkasi } from "@/lib/kiraci/coz";
import { PLATFORM_ADI } from "@/lib/kiraci/tipler";

/**
 * PWA manifesti — HOST'A GÖRE. Kiracı adresinde ad ve simge şirketindir;
 * her kiracının ana ekrana eklediği uygulama kendi adıyla görünür.
 * Kiracı logosu kare olmayabilir; Android `any` amaçlı ikonu kutuya sığdırır,
 * `maskable` yalnız platform ikonunda var (kare üretim gerektirir).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const marka = await kiraciMarkasi();
  const kiraci = marka.tur === "kiraci";
  const ad = kiraci ? `${marka.ad} Paket` : PLATFORM_ADI;

  const ikonlar =
    kiraci && marka.logoAcik
      ? [{ src: marka.logoAcik, sizes: "any", purpose: "any" }]
      : [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ];
  const kisayolIkonu = ikonlar[0]!;

  const manifest = {
    id: "/",
    name: ad,
    short_name: kiraci ? marka.ad.slice(0, 12) : "MarjPanel",
    description: kiraci
      ? `${marka.ad} depo paket okutma — MarjPanel Paket altyapısı.`
      : "Depo paket okutma ve pazaryeri sipariş takibi.",
    start_url: "/?kaynak=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#F5F7F6",
    theme_color: "#F5F7F6",
    orientation: "any",
    lang: "tr",
    dir: "ltr",
    categories: ["business", "productivity", "logistics"],
    prefer_related_applications: false,
    icons: ikonlar,
    shortcuts: [
      { name: "Okut", short_name: "Okut", url: "/okut", icons: [kisayolIkonu] },
      { name: "Paketler", short_name: "Paketler", url: "/paketler", icons: [kisayolIkonu] },
      { name: "Siparişler", short_name: "Sipariş", url: "/siparisler", icons: [kisayolIkonu] },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
