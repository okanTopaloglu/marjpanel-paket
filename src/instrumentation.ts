/**
 * Next.js araç kancası - süreç başına BİR KEZ çalışır.
 *
 * Senkron zamanlayıcısı burada başlar: uygulama ayakta olduğu sürece sipariş
 * çekimi için ayrı bir işçi süreci ya da harici cron GEREKMEZ.
 *
 * KOŞUL NEDEN `if` BLOĞU, NEDEN ERKEN `return` DEĞİL: bu dosya hem Node hem
 * EDGE çalışma zamanı için derlenir (projede `middleware.ts` var). Webpack
 * `process.env.NEXT_RUNTIME` değerini derleme anında sabitler; koşul bir blok
 * olduğunda edge paketinde blok tamamen atılır ve içindeki dinamik `import`
 * hiç çözülmez. Erken `return` ile yazıldığında blok atılmaz, edge derleyicisi
 * `node:crypto`ya kadar inip "Unhandled scheme" ile PATLAR (geliştirme
 * sunucusu bu yüzden hiç ayağa kalkmıyordu).
 *
 * `SENKRON_ZAMANLAYICI=0` zamanlayıcıyı kapatır: yatay ölçeklemede ya da
 * harici cron kullanılırken. Kilit veritabanında olduğu için kapatmak zorunlu
 * değildir, yalnız gereksiz yoklamayı keser.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SENKRON_ZAMANLAYICI === "0") {
      console.log("[senkron] zamanlayıcı kapalı (SENKRON_ZAMANLAYICI=0).");
      return;
    }
    const { zamanlayiciBaslat } = await import("@/lib/senkron/zamanlayici");
    zamanlayiciBaslat();
  }
}
