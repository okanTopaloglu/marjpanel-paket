import type { MetadataRoute } from "next";
import { istekHostu, platformHostu } from "@/lib/kiraci/coz";
import { platformHostuMu } from "@/lib/kiraci/kural";

/**
 * sitemap.xml — yalnız platform adresinde ve yalnız HERKESE AÇIK sayfalar.
 *
 * Şu an tek bir açık sayfa var: kök. Giriş ve kayıt bilerek YOKTUR — dizine
 * girmeleri zararsızdır ama site haritası "önemli sayfalarım bunlar" demektir,
 * giriş formu o listede olmaz.
 *
 * Kiracı adresinde BOŞ döner: robots.txt orada her şeyi kapatıyor, site
 * haritası yayınlamak onunla çelişirdi.
 */
export const dynamic = "force-dynamic";

/**
 * Son değişiklik tarihi DAĞITIM ZAMANIDIR, istek zamanı değil. `new Date()`
 * her istekte değişir ve tarayıcıya "sayfa saniyede bir güncelleniyor" yalanı
 * söyler; bu sinyal güvenilmez bulunup yok sayılır.
 */
const SON_DEGISIKLIK = new Date(
  process.env.BUILD_ZAMANI?.trim() || "2026-09-20T00:00:00Z",
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = await istekHostu();
  const platform = platformHostu();
  if (!platformHostuMu(host, platform)) return [];

  return [
    {
      url: `https://${platform}/`,
      lastModified: SON_DEGISIKLIK,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
