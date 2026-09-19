import {
  bayatlariSerbestBirak,
  bekleyenAl,
  otoIsAc,
} from "@/lib/db/repos/senkron-isleri";
import {
  urunSenkronuVadesiGelenler,
  vadesiGelenler,
} from "@/lib/db/repos/entegrasyonlar";
import { siparisSenkronunuYurut } from "./siparis-senkron";
import { urunSenkronunuYurut } from "./urun-senkron";

/**
 * SENKRON ZAMANLAYICISI — süreç içi saat, kilit VERİTABANINDA.
 *
 * Zamanlayıcı yalnız "şimdi bakılsın mı" sorusunu sorar; "bu işi kim yapacak"
 * sorusunun cevabı `senkron_isleri` üzerindeki kısmi tekil indekstir
 * (bkz. repos/senkron-isleri). Bu yüzden iki Node örneği aynı anda tik atsa
 * bile işi yalnız biri alır.
 *
 * ZİNCİRLEME `setTimeout`, `setInterval` DEĞİL: `setInterval` bir tur 40 sn
 * sürdüğünde bir sonrakini üstüne bindirir; zincir ise ancak öncekinin
 * ardından kurulur, turlar ASLA çakışmaz.
 *
 * DÖNGÜ ÖLMEZ: `tik` içindeki her hata yutulur ve bir sonraki zamanlayıcı yine
 * kurulur. PartnerSys'te tek bir yakalanmamış hata otomatik senkronu sessizce
 * durduruyordu ve kimse fark etmiyordu (siparişler "bir süredir gelmiyor"du).
 */

/** İlk tik, uygulama açılışının yoğunluğuna karışmasın diye 5 sn gecikir. */
export const ILK_GECIKME_MS = 5_000;

/** Turlar arası bekleme. */
export const TUR_ARALIGI_MS = 30_000;

/** Ürün senkronu vadesi bu sıklıkta kontrol edilir (çekimin kendisi 12 saatlik). */
export const URUN_KONTROL_ARALIGI_MS = 30 * 60 * 1000;

interface ZamanlayiciDurumu {
  baslatildi: boolean;
  /** Aynı süreçte iki tik üst üste binmesin (cron ucu da `tik` çağırır). */
  tikCalisiyor: boolean;
  sonUrunKontrolu: number;
}

const genel = globalThis as typeof globalThis & {
  __paketSenkron?: ZamanlayiciDurumu;
};

function durum(): ZamanlayiciDurumu {
  if (!genel.__paketSenkron) {
    genel.__paketSenkron = {
      baslatildi: false,
      tikCalisiyor: false,
      sonUrunKontrolu: 0,
    };
  }
  return genel.__paketSenkron;
}

/**
 * Tek tur.
 *
 * Sıra: bayat kilitleri serbest bırak → kuyrukta bekleyen (manuel) sipariş işi
 * varsa ONU yürüt → yoksa vadesi gelen entegrasyon varsa oto iş aç ve yürüt →
 * ayrıca 30 dakikada bir ürün senkronu vadesine bak.
 *
 * MANUEL İŞ ÖNCELİKLİDİR: kullanıcı düğmeye bastıysa ekranın başında bekliyor.
 * Ürün senkronu sipariş işiyle AYNI TURDA çalıştırılmaz - ikisi de aynı
 * Trendyol satıcısına yüklenir ve 429 riskini ikiye katlardı.
 */
export async function tik(): Promise<void> {
  const d = durum();
  if (d.tikCalisiyor) return;
  d.tikCalisiyor = true;

  try {
    await bayatlariSerbestBirak();

    // 1) Kuyruktaki manuel iş.
    const bekleyen = await bekleyenAl("siparis");
    if (bekleyen) {
      console.log(`[senkron] kuyruktan iş alındı (${bekleyen.tetik}).`);
      await siparisSenkronunuYurut(bekleyen);
      return;
    }

    // 2) Vadesi gelen otomatik sipariş senkronu.
    const vadesi = await vadesiGelenler();
    if (vadesi.length > 0) {
      const is = await otoIsAc("siparis");
      if (is) {
        console.log(`[senkron] oto sipariş turu: ${vadesi.length} entegrasyon.`);
        await siparisSenkronunuYurut(is);
        return;
      }
      // Kilit başkasında - bu tur atlanır, 30 sn sonra yeniden bakılır.
      return;
    }

    // 3) Ürün senkronu: yarım saatte bir yoklanır.
    const simdi = Date.now();
    if (simdi - d.sonUrunKontrolu < URUN_KONTROL_ARALIGI_MS) return;
    d.sonUrunKontrolu = simdi;

    const urunVadesi = await urunSenkronuVadesiGelenler();
    if (urunVadesi.length === 0) return;

    const urunIsi = await otoIsAc("urun");
    if (urunIsi) {
      console.log(`[senkron] oto ürün turu: ${urunVadesi.length} entegrasyon.`);
      await urunSenkronunuYurut(urunIsi);
    }
  } catch (hata) {
    console.error(
      `[senkron] tik hatası: ${hata instanceof Error ? hata.message : String(hata)}`,
    );
  } finally {
    d.tikCalisiyor = false;
  }
}

function siradakiTur(): void {
  const zamanlayici = setTimeout(() => {
    void tik().finally(siradakiTur);
  }, TUR_ARALIGI_MS);
  // Zamanlayıcı süreci ayakta TUTMASIN: testte/betikte süreç kapanabilsin.
  zamanlayici.unref?.();
}

/**
 * Zamanlayıcıyı başlatır. `globalThis` ile korunur: geliştirmede HMR modülü
 * yeniden değerlendirir ve her değerlendirmede yeni bir zincir kurulurdu -
 * birkaç dosya kaydından sonra beş zamanlayıcı aynı anda tik atıyor olurdu.
 */
export function zamanlayiciBaslat(): void {
  const d = durum();
  if (d.baslatildi) return;
  d.baslatildi = true;

  console.log(
    `[senkron] zamanlayıcı başlatıldı (ilk tur ${ILK_GECIKME_MS / 1000} sn sonra, aralık ${TUR_ARALIGI_MS / 1000} sn).`,
  );
  const ilk = setTimeout(() => {
    void tik().finally(siradakiTur);
  }, ILK_GECIKME_MS);
  ilk.unref?.();
}
