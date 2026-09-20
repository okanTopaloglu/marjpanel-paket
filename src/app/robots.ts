import type { MetadataRoute } from "next";
import { SUPER_ONEKLERI, YONETIM_ONEKLERI } from "@/auth.config";
import { istekHostu, platformHostu } from "@/lib/kiraci/coz";
import { platformHostuMu } from "@/lib/kiraci/kural";

/**
 * robots.txt — HOST'A GÖRE.
 *
 * Tek uygulama hem platformu hem N tane kiracı alt alan adını karşılar.
 * Kiracı adresleri (sirket.marjpanel.com) bir şirketin giriş kapısıdır:
 * TAMAMEN kapalıdır. Platformda yalnız tanıtım sayfası açıktır; panelin
 * her yolu kapalıdır.
 *
 * DISALLOW LİSTESİ TÜRETİLİR (auth.config'teki önekler): yeni bir yönetim
 * bölümü eklenince robots.txt kendiliğinden kapatır. Elle yazılmış ikinci bir
 * liste er geç eskirdi.
 *
 * `force-dynamic`: yanıt `Host` başlığına bağlıdır; önbelleğe alınırsa bir
 * kiracının kapalı robots.txt'i platforma (ya da tersi) servis edilebilir.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await istekHostu();
  const platform = platformHostu();

  if (!platformHostuMu(host, platform)) {
    // Kiracı adresi: hiçbir şey dizine girmez, sitemap de bildirilmez.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const kapali = [...SUPER_ONEKLERI, ...YONETIM_ONEKLERI]
    .map((o) => `${o}/`)
    .concat("/api/", "/okut", "/paketler", "/ayarlar", "/tanitim");

  /*
   * AI TARAYICILARINA AÇIK İZİN. GPTBot, PerplexityBot, ClaudeBot ve
   * Google-Extended `*` kuralına zaten uyar; ayrı satır yazmanın sebebi
   * KARARI GÖRÜNÜR KILMAK: bu sitenin AI arama sonuçlarında görünmesi
   * isteniyor. Fikir değişirse burada tek satır kapatılır, kimse
   * "acaba unutuldu mu" diye düşünmez.
   */
  const aiTarayicilari = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: kapali },
      ...aiTarayicilari.map((userAgent) => ({ userAgent, allow: "/", disallow: kapali })),
    ],
    sitemap: `https://${platform}/sitemap.xml`,
    host: `https://${platform}`,
  };
}
