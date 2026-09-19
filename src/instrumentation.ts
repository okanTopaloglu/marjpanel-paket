/**
 * Next.js araç kancası - süreç başına BİR KEZ çalışır.
 *
 * TEK KOD YOLU BUDUR ve bilerek bu kadar incedir: bu dosya hem Node hem EDGE
 * çalışma zamanı için derlenir (projede `middleware.ts` var). Node'a özel
 * kodun tamamı `instrumentation-node.ts` arkasındadır; Next `nodejs` dalını
 * edge paketinde ölü kod olarak atar, böylece `node:crypto`ya kadar inen
 * zincir edge derleyicisine hiç uğramaz. Erken `return` ya da doğrudan
 * `@/lib/senkron/...` ithali bu ayrımı bozar ve geliştirme sunucusu tüm
 * isteklere 500 döner.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
