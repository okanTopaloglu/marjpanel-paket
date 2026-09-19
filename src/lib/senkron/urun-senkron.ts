import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { saglayiciAl } from "@/lib/pazaryeri/saglayici";
import { hataMetni } from "@/lib/pazaryeri/hatalar";
import type { NormalUrun } from "@/lib/pazaryeri/tipler";
import {
  sonUrunSenkronGuncelle,
  urunSenkronuVadesiGelenler,
  kimlikBilgileri,
  type SenkronEntegrasyonu,
} from "@/lib/db/repos/entegrasyonlar";
import { bitir, ilerlemeYaz } from "@/lib/db/repos/senkron-isleri";
import type { SenkronIsi } from "@/lib/db/schema";
import { hatayiIsle } from "./siparis-senkron";

/**
 * ÜRÜN SENKRONU — barkod → ürün adı/görsel kataloğunu tazeler. PLATFORM BİLMEZ.
 *
 * Okutma ekranı barkodu bu tablodan isimlendirir; katalog bozulursa depo
 * "hangi ürün bu" diye soramaz. Bu yüzden yazma kuralı ŞUDUR: YALNIZ DOLU VE
 * DEĞİŞMİŞ ALAN YAZILIR. Trendyol bazı sayfalarda `title`/`images` alanlarını
 * boş yollar; düz `excluded.*` ataması var olan adı ve görseli SİLERDİ.
 * `coalesce(nullif(excluded.x, ''), urunler.x)` boş geleni yok sayar.
 * (PartnerSys aynı korumayı uygulamada, kayıt kayıt karşılaştırarak yapıyordu:
 * 5000 ürünlü katalogda binlerce fazladan sorgu. Burada tek ifade.)
 *
 * Sayfalar arası bekleme SAĞLAYICIDAN gelir (`yetenekler.sayfaArasiMs`):
 * ürün uçları sipariş uçlarından daha sıkı hız sınırlıdır.
 */

/** İş başına azami süre (katalog büyük olabilir). */
export const URUN_IS_ZAMAN_ASIMI_MS = 10 * 60 * 1000;

const AZAMI_SAYFA = 200;

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Geriye uyumlu ad: `EslenenUrun` artık `NormalUrun`. */
export type EslenenUrun = NormalUrun;

/** Ürün satırlarını yazar; dolu ve değişmiş alan kuralı SQL'de uygulanır. */
export async function urunleriYaz(
  sirketId: string,
  urunSatirlari: NormalUrun[],
): Promise<number> {
  if (urunSatirlari.length === 0) return 0;

  const degerler = urunSatirlari.map(
    (u) => sql`(
      ${sirketId}::uuid,
      ${u.barkod},
      ${u.urunAdi},
      ${u.gorselUrl},
      ${u.marka},
      ${u.kategori},
      ${u.stokKodu},
      now()
    )`,
  );

  const sonuc = await db.execute<{ id: string }>(sql`
    insert into urunler (
      sirket_id, barkod, urun_adi, gorsel_url, marka, kategori, stok_kodu, son_senkron
    )
    values ${sql.join(degerler, sql`, `)}
    on conflict (sirket_id, barkod) do update set
      urun_adi   = coalesce(nullif(excluded.urun_adi, ''), urunler.urun_adi),
      gorsel_url = coalesce(nullif(excluded.gorsel_url, ''), urunler.gorsel_url),
      marka      = coalesce(nullif(excluded.marka, ''), urunler.marka),
      kategori   = coalesce(nullif(excluded.kategori, ''), urunler.kategori),
      stok_kodu  = coalesce(nullif(excluded.stok_kodu, ''), urunler.stok_kodu),
      son_senkron = now(),
      updated_at  = now()
    where
      -- Değişen bir şey yoksa satır HİÇ yazılmaz: 5000 ürünlük katalogda her
      -- 12 saatte bir tüm tabloyu yeniden yazmak indeksleri boş yere şişirir.
      urunler.urun_adi   is distinct from coalesce(nullif(excluded.urun_adi, ''), urunler.urun_adi)
      or urunler.gorsel_url is distinct from coalesce(nullif(excluded.gorsel_url, ''), urunler.gorsel_url)
      or urunler.marka      is distinct from coalesce(nullif(excluded.marka, ''), urunler.marka)
      or urunler.kategori   is distinct from coalesce(nullif(excluded.kategori, ''), urunler.kategori)
      or urunler.stok_kodu  is distinct from coalesce(nullif(excluded.stok_kodu, ''), urunler.stok_kodu)
      or urunler.son_senkron is null
      or urunler.son_senkron < now() - interval '1 day'
    returning id
  `);
  return sonuc.length;
}

async function birEntegrasyon(
  is: SenkronIsi,
  e: SenkronEntegrasyonu,
  sonAn: number,
  tamamlanan: Record<string, number>,
): Promise<number> {
  const saglayici = saglayiciAl(e);
  if (!saglayici.yetenekler.urun || !saglayici.urunler) {
    throw new Error("Bu pazaryeri ürün kataloğu vermiyor.");
  }
  const { sayfaArasiMs } = saglayici.yetenekler;

  let yazilanToplam = 0;
  let apidenToplam = 0;
  let imlec: string | null = null;

  for (let sayfaNo = 0; sayfaNo < AZAMI_SAYFA; sayfaNo++) {
    if (Date.now() > sonAn) break;

    const yanit = await saglayici.urunler({ imlec });
    apidenToplam += yanit.kayitlar.length;

    if (yanit.kayitlar.length) {
      yazilanToplam += await urunleriYaz(e.sirketId, yanit.kayitlar);
    }

    await ilerlemeYaz(is.id, {
      adim: "urun",
      entegrasyon: e.ad,
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

  console.log(
    `[senkron] ${e.ad} ürün: ${apidenToplam} kayıt okundu, ${yazilanToplam} satır yazıldı.`,
  );
  return yazilanToplam;
}

export async function urunSenkronunuYurut(is: SenkronIsi): Promise<{
  toplam: number;
  hatalar: string[];
}> {
  const sonAn = Date.now() + URUN_IS_ZAMAN_ASIMI_MS;
  const tamamlanan: Record<string, number> = {};
  const hatalar: string[] = [];
  let toplam = 0;

  try {
    const liste = is.entegrasyonId
      ? await (async () => {
          const e = await kimlikBilgileri(is.entegrasyonId!, is.sirketId ?? undefined);
          return e ? [e] : [];
        })()
      : await urunSenkronuVadesiGelenler();

    if (liste.length === 0) {
      await bitir(is.id, "tamam", "Ürün senkronu için vadesi gelen entegrasyon yok.");
      return { toplam: 0, hatalar };
    }

    for (const e of liste) {
      if (Date.now() > sonAn) {
        hatalar.push("İş 10 dakikalık süre sınırını aştı, tur kesildi.");
        break;
      }
      try {
        const yazilan = await birEntegrasyon(is, e, sonAn, tamamlanan);
        tamamlanan[e.ad] = yazilan;
        toplam += yazilan;
        await sonUrunSenkronGuncelle(e.id);
      } catch (hata) {
        const onek = await hatayiIsle(e, hata);
        const mesaj = `${e.ad}: ${hataMetni(hata)}`;
        console.warn(`[senkron] ürün ${onek} - ${mesaj}`);
        hatalar.push(mesaj);
        tamamlanan[e.ad] = -1;
      }
    }

    const ozet =
      `${toplam} ürün güncellendi (${liste.length} entegrasyon)` +
      (hatalar.length ? `, ${hatalar.length} hata` : "");
    await bitir(is.id, hatalar.length ? "hata" : "tamam", ozet, hatalar);
    console.log(`[senkron] ürün işi bitti: ${ozet}`);
  } catch (hata) {
    const mesaj = hataMetni(hata);
    console.error(`[senkron] ürün işi düştü: ${mesaj}`);
    hatalar.push(mesaj);
    await bitir(is.id, "hata", `Ürün senkronu düştü: ${mesaj}`, hatalar);
  }

  return { toplam, hatalar };
}
