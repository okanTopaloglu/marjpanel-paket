import { normaldenSatir, type EslenenSiparis } from "@/lib/pazaryeri/normal-veri";
import { genisTaramaGerekliMi, taramaBaslangici, tarihPencereleri } from "@/lib/pazaryeri/pencere";
import { saglayiciAl } from "@/lib/pazaryeri/saglayici";
import {
  PazaryeriHizSiniri,
  PazaryeriKimlikHatasi,
  hataMetni,
} from "@/lib/pazaryeri/hatalar";
import { topluUpsert } from "@/lib/db/repos/siparisler";
import {
  kimlikBilgileri,
  sonGenisTaramaGuncelle,
  sonHataYaz,
  sonSiparisSenkronGuncelle,
  vadesiGelenler,
  type SenkronEntegrasyonu,
} from "@/lib/db/repos/entegrasyonlar";
import { bitir, ilerlemeYaz } from "@/lib/db/repos/senkron-isleri";
import type { SenkronIsi } from "@/lib/db/schema";

/**
 * SİPARİŞ SENKRONU — bir "iş" satırını yürüten motor. PLATFORM BİLMEZ.
 *
 * Akış (entegrasyon başına): `saglayiciAl` → `senkronBaslangici` →
 * sağlayıcının izin verdiği genişlikte `tarihPencereleri` → her pencerede
 * imleç `null` olana kadar sayfa → `normaldenSatir` → `topluUpsert`.
 *
 * ÜÇ KARAR PARTNERSYS'TEN AYRILIR:
 *
 *  1. BİR ENTEGRASYONUN HATASI DİĞERLERİNİ DÜŞÜRMEZ. Hata `hatalar`
 *     dizisine ve entegrasyonun `son_hata` sütununa yazılır, döngü devam eder.
 *  2. 429 YALNIZ O ENTEGRASYONU DURDURUR ve `Retry-After` kadar (en az 60 sn)
 *     ERTELER. Hız sınırı satıcı bazlıdır; diğer satıcıyla çekim sürer.
 *     401/403 bir saat erteler: yanlış anahtarla her 2 dakikada bir vurmak
 *     hesabı kilitletebilir.
 *  3. İŞ BAŞINA 5 DAKİKALIK SERT SINIR. Süre dolduğunda tur kesilir ve iş
 *     "hata" ile kapanır; kilit serbest kalır.
 */

/** İş başına azami süre. */
export const IS_ZAMAN_ASIMI_MS = 5 * 60 * 1000;

/** Bir pencerede okunacak azami sayfa (sonsuz döngü emniyeti). */
const AZAMI_SAYFA = 100;

/** 429'da asgari erteleme; Retry-After daha uzunsa o kazanır. */
export const HIZ_SINIRI_ERTELEME_SN = 60;
/** 401/403'te erteleme. */
export const KIMLIK_HATASI_ERTELEME_SN = 60 * 60;

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SenkronSonucu {
  toplam: number;
  tamamlanan: Record<string, number>;
  hatalar: string[];
  zamanAsimi: boolean;
}

/** İşin hedefleyeceği entegrasyonlar: manuel işte tek kayıt, oto işte vadesi gelenler. */
async function hedefler(is: SenkronIsi): Promise<SenkronEntegrasyonu[]> {
  if (is.entegrasyonId) {
    const e = await kimlikBilgileri(is.entegrasyonId, is.sirketId ?? undefined);
    return e ? [e] : [];
  }
  return vadesiGelenler();
}

async function birEntegrasyon(
  is: SenkronIsi,
  e: SenkronEntegrasyonu,
  sonAn: number,
  tamamlanan: Record<string, number>,
): Promise<{ yazilan: number; genis: boolean }> {
  const saglayici = saglayiciAl(e);
  const { azamiPencereGun, sayfaArasiMs, ilkSenkronGun } = saglayici.yetenekler;

  const simdi = Date.now();
  // Geniş tarama: eski siparişlerin durumu da güncellensin (bkz. pencere.ts).
  const genis = genisTaramaGerekliMi(e.sonGenisTarama, new Date(simdi));
  const pencereler = tarihPencereleri(
    taramaBaslangici(e.sonSiparisSenkron, genis, new Date(simdi), ilkSenkronGun),
    simdi,
    azamiPencereGun,
  );
  let yazilanToplam = 0;
  let apidenToplam = 0;

  for (const [indeks, pencere] of pencereler.entries()) {
    let imlec: string | null = null;
    for (let sayfaNo = 0; sayfaNo < AZAMI_SAYFA; sayfaNo++) {
      if (Date.now() > sonAn) return { yazilan: yazilanToplam, genis: false };

      const yanit = await saglayici.siparisler({
        baslangic: pencere.baslangic,
        bitis: pencere.bitis,
        imlec,
      });
      apidenToplam += yanit.kayitlar.length;

      const satirlar: EslenenSiparis[] = yanit.kayitlar.map((n) => normaldenSatir(n, e.ad));
      if (satirlar.length) {
        yazilanToplam += await topluUpsert(e.sirketId, satirlar);
      }

      await ilerlemeYaz(is.id, {
        adim: "siparis",
        entegrasyon: e.ad,
        pencere: indeks + 1,
        toplamPencere: pencereler.length,
        sayfa: yanit.sayfaNo ?? sayfaNo,
        toplamSayfa: yanit.toplamSayfa ?? null,
        apiden: apidenToplam,
        yazilan: yazilanToplam,
        tamamlanan: { ...tamamlanan, [e.ad]: yazilanToplam },
      });

      imlec = yanit.sonrakiImlec;
      if (imlec === null) break;
      if (sayfaArasiMs > 0) await bekle(sayfaArasiMs);
    }
  }

  console.log(
    `[senkron] ${e.ad}: ${apidenToplam} kayıt okundu, ${yazilanToplam} satır yazıldı${genis ? " (geniş tarama)" : ""}.`,
  );
  return { yazilan: yazilanToplam, genis };
}

/** Hata türüne göre entegrasyona ne yazılacağı. Dönüş: log öneki. */
export async function hatayiIsle(e: { id: string }, hata: unknown): Promise<string> {
  const mesaj = hataMetni(hata);
  if (hata instanceof PazaryeriHizSiniri) {
    const sn = Math.max(HIZ_SINIRI_ERTELEME_SN, hata.tekrarSaniye ?? 0);
    await sonHataYaz(e.id, mesaj, sn);
    return "hız sınırı";
  }
  if (hata instanceof PazaryeriKimlikHatasi) {
    await sonHataYaz(e.id, mesaj, KIMLIK_HATASI_ERTELEME_SN);
    return "kimlik hatası";
  }
  await sonHataYaz(e.id, mesaj);
  return "hata";
}

/** İşi yürütür ve `senkron_isleri` satırını kapatır. */
export async function siparisSenkronunuYurut(is: SenkronIsi): Promise<SenkronSonucu> {
  const sonAn = Date.now() + IS_ZAMAN_ASIMI_MS;
  const tamamlanan: Record<string, number> = {};
  const hatalar: string[] = [];
  let toplam = 0;
  let zamanAsimi = false;

  try {
    const liste = await hedefler(is);
    if (liste.length === 0) {
      await bitir(is.id, "tamam", "Vadesi gelen entegrasyon yok.");
      return { toplam: 0, tamamlanan, hatalar, zamanAsimi };
    }

    for (const e of liste) {
      if (Date.now() > sonAn) {
        zamanAsimi = true;
        break;
      }
      try {
        const { yazilan, genis } = await birEntegrasyon(is, e, sonAn, tamamlanan);
        tamamlanan[e.ad] = yazilan;
        toplam += yazilan;
        await sonSiparisSenkronGuncelle(e.id);
        if (genis) await sonGenisTaramaGuncelle(e.id);
      } catch (hata) {
        const onek = await hatayiIsle(e, hata);
        const mesaj = `${e.ad}: ${hataMetni(hata)}`;
        console.warn(`[senkron] ${onek} - ${mesaj}`);
        hatalar.push(mesaj);
        tamamlanan[e.ad] = -1;
      }
    }

    if (Date.now() > sonAn) zamanAsimi = true;
    if (zamanAsimi) hatalar.push("İş 5 dakikalık süre sınırını aştı, tur kesildi.");

    const ozet =
      `${toplam} sipariş yazıldı (${liste.length} entegrasyon)` +
      (hatalar.length ? `, ${hatalar.length} hata` : "");
    await bitir(is.id, hatalar.length ? "hata" : "tamam", ozet, hatalar);
    console.log(`[senkron] sipariş işi bitti: ${ozet}`);
  } catch (hata) {
    // Beklenmeyen hata: iş MUTLAKA kapanmalı, yoksa kilit 5 dakika tutulur.
    const mesaj = hataMetni(hata);
    console.error(`[senkron] sipariş işi düştü: ${mesaj}`);
    hatalar.push(mesaj);
    await bitir(is.id, "hata", `Sipariş senkronu düştü: ${mesaj}`, hatalar);
  }

  return { toplam, tamamlanan, hatalar, zamanAsimi };
}
