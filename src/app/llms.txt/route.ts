import { istekHostu, platformHostu } from "@/lib/kiraci/coz";
import { platformHostuMu } from "@/lib/kiraci/kural";
import { HIZMETLER, OZELLIKLER, SSS_LISTESI, SITE_ADI } from "@/app/(site)/tanitim/icerik";

/**
 * llms.txt — AI asistanları için sayfanın düz metin özeti (llmstxt.org).
 *
 * NEDEN: ChatGPT, Perplexity ve Google AI Overviews sayfayı işlerken
 * gürültüsüz, pasaj düzeyinde alıntılanabilir metni tercih eder. HTML'i
 * ayrıştırmak zorunda kalmadan "bu site ne yapar" sorusunun cevabını bulur.
 *
 * İÇERİK TEK KAYNAKTAN (`icerik.ts`): sayfa metni değişince bu dosya da
 * değişir. Ayrı yazılsaydı ikisi sessizce çelişirdi.
 *
 * Kiracı adresinde 404: orası pazarlama yüzeyi değil.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const host = await istekHostu();
  const platform = platformHostu();
  if (!platformHostuMu(host, platform)) {
    return new Response("Not found", { status: 404 });
  }

  const url = `https://${platform}`;
  const metin = [
    `# ${SITE_ADI}`,
    "",
    `> Türkiye'de pazaryerinde satış yapan e-ticaret firmaları için depo ve paketleme hizmeti ile sipariş yönetim paneli. Trendyol, Hepsiburada, N11, Pazarama, idefix ve Amazon entegrasyonu.`,
    "",
    "## Ne yapar",
    "",
    ...HIZMETLER.map((h) => `- ${h.baslik}: ${h.ozet}`),
    "",
    "## Öne çıkan özellikler",
    "",
    ...OZELLIKLER.map((o) => `- ${o.baslik}: ${o.metin}`),
    "",
    "## Sık sorulan sorular",
    "",
    ...SSS_LISTESI.flatMap((s) => [`### ${s.soru}`, "", s.cevap, ""]),
    "## Bağlantılar",
    "",
    `- Anasayfa: ${url}/`,
    `- Panel girişi: ${url}/giris`,
    "",
  ].join("\n");

  return new Response(metin, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
