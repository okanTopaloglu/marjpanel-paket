import {
  trendyolIstemcisi,
  SAYFA_BOYUTU,
  TrendyolHizSiniri,
  type SayfaliYanit,
  type HamSiparis,
} from "@/lib/trendyol/istemci";
import { siparisEsle, type EslenenSiparis } from "@/lib/trendyol/esle";
import { senkronBaslangici, tarihPencereleri } from "@/lib/trendyol/pencere";
import { topluUpsert } from "@/lib/db/repos/siparisler";
import {
  kimlikBilgileri,
  sonSiparisSenkronGuncelle,
  vadesiGelenler,
  type SenkronEntegrasyonu,
} from "@/lib/db/repos/entegrasyonlar";
import { bitir, ilerlemeYaz } from "@/lib/db/repos/senkron-isleri";
import type { SenkronIsi } from "@/lib/db/schema";

/**
 * SİPARİŞ SENKRONU — bir "iş" satırını yürüten motor.
 *
 * Akış (entegrasyon başına): `senkronBaslangici` → 14 günlük `tarihPencereleri`
 * → her pencerede 200'lük sayfalar → `siparisEsle` → `topluUpsert`.
 *
 * ÜÇ KARAR PARTNERSYS'TEN AYRILIR:
 *
 *  1. BİR ENTEGRASYONUN HATASI DİĞERLERİNİ DÜŞÜRMEZ. PartnerSys'te tek
 *     `throw` tüm turu bitiriyordu: bir mağazanın anahtarı dolduğunda diğer
 *     mağazaların siparişleri de gelmiyordu. Hata `hatalar` dizisine yazılır,
 *     döngü devam eder.
 *  2. 429 YALNIZ O ENTEGRASYONU DURDURUR. Hız sınırı satıcı bazlıdır; diğer
 *     satıcı kimliğiyle çekim yapmaya devam etmek doğrudur.
 *  3. İŞ BAŞINA 5 DAKİKALIK SERT SINIR. Süre dolduğunda tur kesilir ve iş
 *     "hata" ile kapanır; kilit serbest kalır (kilidi bayat bırakıp
 *     `bayatlariSerbestBirak`ın toparlamasını beklemek 5 dakika daha kaybettirirdi).
 */

/** İş başına azami süre. */
export const IS_ZAMAN_ASIMI_MS = 5 * 60 * 1000;

/** Bir pencerede okunacak azami sayfa (sonsuz döngü emniyeti). */
const AZAMI_SAYFA = 100;

function saatOfseti(): number {
  const n = Number(process.env.TRENDYOL_SIPARIS_SAAT_OFSETI ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hataMetni(hata: unknown): string {
  return hata instanceof Error ? hata.message : String(hata);
}

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
): Promise<number> {
  const istemci = trendyolIstemcisi({
    saticiId: e.saticiId,
    apiKey: e.apiKey,
    apiSecret: e.apiSecret,
  });

  const simdi = Date.now();
  const pencereler = tarihPencereleri(senkronBaslangici(e.sonSiparisSenkron), simdi);
  let yazilanToplam = 0;
  let apidenToplam = 0;

  for (const [indeks, pencere] of pencereler.entries()) {
    for (let sayfaNo = 0; sayfaNo < AZAMI_SAYFA; sayfaNo++) {
      if (Date.now() > sonAn) return yazilanToplam;

      const yanit: SayfaliYanit<HamSiparis> = await istemci.siparisler({
        baslangic: pencere.baslangic,
        bitis: pencere.bitis,
        sayfa: sayfaNo,
      });
      apidenToplam += yanit.content.length;

      const eslenen = yanit.content
        .map((ham) =>
          siparisEsle(ham, { entegrasyonAdi: e.ad, saatOfseti: saatOfseti() }),
        )
        .filter((s): s is EslenenSiparis => s !== null);

      if (eslenen.length) {
        yazilanToplam += await topluUpsert(e.sirketId, eslenen);
      }

      await ilerlemeYaz(is.id, {
        adim: "siparis",
        entegrasyon: e.ad,
        pencere: indeks + 1,
        toplamPencere: pencereler.length,
        sayfa: sayfaNo,
        toplamSayfa: yanit.totalPages ?? null,
        apiden: apidenToplam,
        yazilan: yazilanToplam,
        tamamlanan: { ...tamamlanan, [e.ad]: yazilanToplam },
      });

      // Son sayfa: dolmamış sayfa ya da API'nin bildirdiği toplam sayfaya varış.
      if (yanit.content.length < SAYFA_BOYUTU) break;
      if (yanit.totalPages != null && sayfaNo + 1 >= yanit.totalPages) break;
    }
  }

  console.log(
    `[senkron] ${e.ad}: ${apidenToplam} kayıt okundu, ${yazilanToplam} satır yazıldı.`,
  );
  return yazilanToplam;
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
        const yazilan = await birEntegrasyon(is, e, sonAn, tamamlanan);
        tamamlanan[e.ad] = yazilan;
        toplam += yazilan;
        await sonSiparisSenkronGuncelle(e.id);
      } catch (hata) {
        // 429: bu satıcı için çekim bırakılır, diğerlerine devam edilir.
        const onek = hata instanceof TrendyolHizSiniri ? "hız sınırı" : "hata";
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
