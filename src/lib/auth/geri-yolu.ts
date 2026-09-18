/**
 * Giriş sonrası dönülecek yolun doğrulaması (`?geri=`).
 *
 * YALNIZ kendi sitemizde bir yol kabul edilir. `//baska.site` ve `https://...`
 * açık yönlendirme (open redirect) zafiyetidir: saldırgan kullanıcıyı gerçek
 * giriş sayfamızdan geçirip kendi kopyasına düşürebilir. Ters eğik çizgi de
 * bazı tarayıcılarda eğik çizgi gibi çözüldüğü için elenir.
 *
 * `"use server"` dosyasında DEĞİL burada durur: o dosyalardan yalnız async
 * fonksiyon dışa aktarılabilir (Next.js kısıtı) ve bu yardımcıyı hem eylem hem
 * giriş sayfası kullanır.
 */
export function guvenliGeriYolu(ham: string | null | undefined): string | null {
  if (!ham) return null;
  if (!ham.startsWith("/")) return null;
  if (ham.startsWith("//")) return null;
  if (ham.includes("\\")) return null;
  return ham;
}
