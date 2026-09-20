import {
  ADIMLAR,
  HIZMETLER,
  META_ACIKLAMA,
  SITE_ADI,
  SITE_URL,
  SSS_LISTESI,
} from "./icerik";

/**
 * JSON-LD — arama motorlarına ve AI asistanlarına sayfanın ne olduğunu söyler.
 *
 * TEK `@graph`: Google birden çok ayrı script yerine tek grafiği tercih eder
 * ve düğümler `@id` ile birbirine bağlanır (Organization <- Service.provider).
 *
 * İÇERİKLE AYNI KAYNAKTAN: sorular ve hizmet açıklamaları `icerik.ts`ten
 * okunur. Yapılandırılmış veri ile görünen metin çelişirse Google
 * yapılandırılmış veriyi yok sayar, hatta manuel işlem uygular.
 *
 * UYDURMA ALAN YOK: fiyat, puan (aggregateRating), yorum sayısı ve fiziksel
 * adres BİLEREK boştur. Gerçek olmayan `AggregateRating` yapısal veri
 * ihlalidir; `priceRange` uydurmak da müşteriyi yanıltır. Adres netleşince
 * `LOCAL_BUSINESS_TODO` notundaki alanlar doldurulup graph'a eklenecek.
 */

const ORG_ID = `${SITE_URL}/#kurulus`;
const SITE_ID = `${SITE_URL}/#website`;
const SAYFA_ID = `${SITE_URL}/#anasayfa`;

/**
 * TODO (deponun açık adresi netleşince): buraya `LocalBusiness` düğümü eklenip
 * `@graph`e katılacak. Gereken alanlar: streetAddress, addressLocality,
 * addressRegion, postalCode, telephone, openingHoursSpecification, geo.
 * Adres olmadan LocalBusiness eklemek zorlama olur ve rich result almaz.
 */
export const LOCAL_BUSINESS_TODO = true;

export function yapilandirilmisVeri(): string {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE_ADI,
      url: SITE_URL,
      description: META_ACIKLAMA,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icons/icon-512.png`,
        width: 512,
        height: 512,
      },
      areaServed: { "@type": "Country", name: "Türkiye" },
      knowsLanguage: "tr-TR",
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      url: SITE_URL,
      name: SITE_ADI,
      inLanguage: "tr-TR",
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "WebPage",
      "@id": SAYFA_ID,
      url: SITE_URL,
      name: SITE_ADI,
      description: META_ACIKLAMA,
      inLanguage: "tr-TR",
      isPartOf: { "@id": SITE_ID },
      about: { "@id": ORG_ID },
      primaryImageOfPage: { "@type": "ImageObject", url: `${SITE_URL}/og.png` },
    },
    /* Hizmet 1: fulfillment. Fiyat YOK - teklif usulü çalışılıyor. */
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#depo-hizmeti`,
      name: HIZMETLER[0]!.baslik,
      description: HIZMETLER[0]!.ozet,
      serviceType: "E-ticaret depo ve paketleme hizmeti",
      provider: { "@id": ORG_ID },
      areaServed: { "@type": "Country", name: "Türkiye" },
      audience: { "@type": "BusinessAudience", name: "Pazaryerinde satış yapan e-ticaret firmaları" },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Depo hizmeti kalemleri",
        itemListElement: HIZMETLER[0]!.maddeler.map((m) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: m },
        })),
      },
    },
    /* Hizmet 2: yazılım. SoftwareApplication, Google'ın desteklediği tip. */
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#panel`,
      name: `${SITE_ADI} paneli`,
      description: HIZMETLER[1]!.ozet,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Sipariş ve depo yönetimi",
      operatingSystem: "Web, Android, iOS (PWA)",
      inLanguage: "tr-TR",
      featureList: HIZMETLER[1]!.maddeler,
      publisher: { "@id": ORG_ID },
    },
    /*
     * FAQPage: Google Ağustos 2023'ten beri SSS zengin sonucunu yalnız kamu
     * kurumu ve sağlık sitelerine gösteriyor, yani BURADA AÇILIR KUTU ÇIKMAZ.
     * Yine de duruyor: ChatGPT, Perplexity ve AI Overviews bu temiz soru-cevap
     * yapısından pasaj alıntılıyor. Beklenti bu, "zengin sonuç" değil.
     */
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#sss`,
      inLanguage: "tr-TR",
      isPartOf: { "@id": SAYFA_ID },
      mainEntity: SSS_LISTESI.map((s) => ({
        "@type": "Question",
        name: s.soru,
        acceptedAnswer: { "@type": "Answer", text: s.cevap },
      })),
    },
    /*
     * ADIMLAR: `HowTo` DEĞİL `ItemList`. Google HowTo zengin sonucunu 2023'te
     * emekliye ayırdı; kalan HowTo işaretlemesi artık bir fayda sağlamıyor,
     * yalnız doğrulayıcıda gürültü yapıyor. ItemList hem geçerli hem de AI
     * arama motorlarının sıralı akışı doğru okumasına yetiyor.
     */
    {
      "@type": "ItemList",
      "@id": `${SITE_URL}/#nasil-calisir`,
      name: "MarjPanel Paket nasıl çalışır",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: ADIMLAR.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: a.baslik,
        description: a.metin,
      })),
    },
  ];

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}
