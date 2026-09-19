/**
 * YALNIZ NODE ÇALIŞMA ZAMANI - senkron zamanlayıcısının açılış noktası.
 *
 * `instrumentation.ts` bu dosyayı yalnız `NEXT_RUNTIME === "nodejs"` dalında
 * dinamik olarak ithal eder. AYRI DOSYA OLMASININ SEBEBİ: `instrumentation.ts`
 * hem Node hem EDGE için derlenir (projede `middleware.ts` var) ve edge
 * derlemesi `node:crypto`ya kadar inen her bağımlılıkta "Unhandled scheme"
 * ile patlar; patladığında geliştirme sunucusu HER isteğe 500 döner. Node'a
 * özel her şey bu dosyanın arkasında kalır, edge paketi bu dalı hiç görmez.
 */
export async function senkronuBaslat(): Promise<void> {
  if (process.env.SENKRON_ZAMANLAYICI === "0") {
    console.log("[senkron] zamanlayıcı kapalı (SENKRON_ZAMANLAYICI=0).");
    return;
  }
  const { zamanlayiciBaslat } = await import("@/lib/senkron/zamanlayici");
  zamanlayiciBaslat();
}

/**
 * Modül yüklendiğinde başlar; `instrumentation.ts` yalnız ithal eder.
 * Üst düzey `await` KULLANILMAZ - derleyici desteği çalışma zamanına ve
 * paketleyici ayarına bağlıdır; açılışı beklemenin de bir faydası yok
 * (zamanlayıcı zaten ilk turu 5 sn sonraya kuruyor).
 */
void senkronuBaslat();
