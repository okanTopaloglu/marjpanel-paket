import { and, asc, count, eq, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { db, type DB } from "@/lib/db/client";
import { entegrasyonlar, pazaryeriSiparisleri } from "@/lib/db/schema";
import { kalemleriCikar } from "@/lib/siparis/icerik-imzasi";
import { BEKLEYEN_DURUMLAR } from "@/lib/siparis/sabitler";
import { barkodlarlaGetir } from "@/lib/db/repos/urunler";
import type { OkutmaKalemi } from "@/lib/okut/sonuc";

/**
 * OKUTMA AKIŞININ SİPARİŞ SORGULARI.
 *
 * Sipariş listesi/senkron repoları (`repos/siparisler`, `lib/senkron`) BAŞKA
 * bir akışa aittir ve ayrı bir ajanın sorumluluğundadır. Okutma ekranının
 * ihtiyacı dar ve sıcaktır - takip numarasıyla tek sipariş bulmak, paketi
 * hazır işaretlemek, bekleyen sayısını göstermek - bu yüzden burada, kendi
 * dosyasında durur. Her fonksiyon `sirketId`'yi AÇIK parametre alır.
 */

/** `db` ya da açık bir işlem (transaction). */
export type Islem = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Hazır işaretleme ve okutma engelinde dışarıda bırakılan durumlar. */
const KAPANMIS_DURUMLAR = ["Shipped", "Delivered", "Cancelled"] as const;

export interface OkutSiparisi {
  id: string;
  siparisNo: string | null;
  durum: string;
  platform: string;
  entegrasyonAdi: string | null;
  kargoFirmasi: string | null;
  kalemler: OkutmaKalemi[];
}

/**
 * Barkod → sipariş. Kargo takip numarası ÖNCE denenir, bulunamazsa sipariş
 * numarası: depoda bazı etiketlerde takip numarası değil sipariş numarası
 * basılıdır. Takip numarası eşleşmesi her zaman önceliklidir (aynı değer iki
 * siparişte farklı alanlara denk gelebilir).
 */
export async function takipNoIleSiparis(
  sirketId: string,
  barkod: string,
): Promise<OkutSiparisi | null> {
  const [satir] = await db
    .select({
      id: pazaryeriSiparisleri.id,
      siparisNo: pazaryeriSiparisleri.siparisNo,
      durum: pazaryeriSiparisleri.durum,
      platform: pazaryeriSiparisleri.platform,
      entegrasyonAdi: pazaryeriSiparisleri.entegrasyonAdi,
      kargoFirmasi: pazaryeriSiparisleri.kargoFirmasi,
      hamVeri: pazaryeriSiparisleri.hamVeri,
    })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, sirketId),
        or(
          eq(pazaryeriSiparisleri.kargoTakipNo, barkod),
          eq(pazaryeriSiparisleri.siparisNo, barkod),
        ),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${pazaryeriSiparisleri.kargoTakipNo} = ${barkod} THEN 0 ELSE 1 END`,
    )
    .limit(1);

  if (!satir) return null;

  const ham = kalemleriCikar(satir.hamVeri);
  const urunHaritasi = await barkodlarlaGetir(
    sirketId,
    ham.map((k) => k.barkod),
  );

  const kalemler: OkutmaKalemi[] = ham.map((k) => {
    const urun = urunHaritasi.get(k.barkod);
    return {
      barkod: k.barkod,
      // Pazaryeri adı "-" ise ürün kartındaki ad devreye girer.
      urunAdi: k.urunAdi !== "-" ? k.urunAdi : (urun?.urunAdi ?? "-"),
      adet: k.adet,
      gorselUrl: urun?.gorselUrl ?? null,
    };
  });

  return {
    id: satir.id,
    siparisNo: satir.siparisNo,
    durum: satir.durum,
    platform: satir.platform,
    entegrasyonAdi: satir.entegrasyonAdi,
    kargoFirmasi: satir.kargoFirmasi,
    kalemler,
  };
}

/**
 * Barkoda karşılık gelen siparişi HAZIR işaretler. Koşullar tek UPDATE'te:
 * zaten hazır olan yeniden damgalanmaz (ilk hazırlama anı korunur), kapanmış
 * sipariş (kargolanmış/iptal) hiç dokunulmaz. Dönüş: etkilenen satır sayısı.
 *
 * `islem` parametresi okutma kaydıyla AYNI işlemde çalışabilmek içindir:
 * paket kaydı yazılıp sipariş işaretlenemezse ikisi birden geri alınır.
 */
export async function hazirIsaretle(
  islem: Islem,
  sirketId: string,
  barkod: string,
): Promise<number> {
  const satirlar = await islem
    .update(pazaryeriSiparisleri)
    .set({ hazirZamani: new Date(), sonGuncelleme: new Date() })
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, sirketId),
        eq(pazaryeriSiparisleri.kargoTakipNo, barkod),
        isNull(pazaryeriSiparisleri.hazirZamani),
        notInArray(pazaryeriSiparisleri.durum, [...KAPANMIS_DURUMLAR]),
      ),
    )
    .returning({ id: pazaryeriSiparisleri.id });

  return satirlar.length;
}

export interface BekleyenSayilari {
  toplam: number;
  entegrasyonBazinda: Array<{ ad: string; adet: number }>;
}

/**
 * "Kargoya verilmesi gereken" sayacı: hazırlanmamış, bekleyen durumda ve
 * takip numarası gelmiş siparişler. Entegrasyon kırılımı okutma ekranında
 * hangi mağazanın biriktiğini gösterir.
 */
export async function bekleyenSayilari(
  sirketId: string,
): Promise<BekleyenSayilari> {
  const satirlar = await db
    .select({
      ad: pazaryeriSiparisleri.entegrasyonAdi,
      adet: count(),
    })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, sirketId),
        isNull(pazaryeriSiparisleri.hazirZamani),
        inArray(pazaryeriSiparisleri.durum, [...BEKLEYEN_DURUMLAR]),
        isNotNull(pazaryeriSiparisleri.kargoTakipNo),
      ),
    )
    .groupBy(pazaryeriSiparisleri.entegrasyonAdi);

  let toplam = 0;
  const entegrasyonBazinda: Array<{ ad: string; adet: number }> = [];
  for (const s of satirlar) {
    toplam += s.adet;
    entegrasyonBazinda.push({ ad: s.ad ?? "Bilinmiyor", adet: s.adet });
  }
  entegrasyonBazinda.sort((a, b) => b.adet - a.adet);

  return { toplam, entegrasyonBazinda };
}

/** Şirketin aktif pazaryeri bağlantısı var mı (uyarı kararları buna bakar). */
export async function aktifEntegrasyonVarMi(sirketId: string): Promise<boolean> {
  const [satir] = await db
    .select({ adet: count() })
    .from(entegrasyonlar)
    .where(
      and(eq(entegrasyonlar.sirketId, sirketId), eq(entegrasyonlar.aktif, true)),
    );
  return (satir?.adet ?? 0) > 0;
}

export interface EntegrasyonSecenegi {
  id: string;
  ad: string;
  platform: string;
}

/**
 * Okutma ekranındaki mağaza seçici. SALT OKUNUR: entegrasyon yönetimi
 * (ekleme, anahtar güncelleme, test) başka bir dosyanın işidir; buradan
 * yalnız ad/platform okunur, API anahtarlarına hiç dokunulmaz.
 */
export async function entegrasyonSecenekleri(
  sirketId: string,
): Promise<EntegrasyonSecenegi[]> {
  const satirlar = await db
    .select({
      id: entegrasyonlar.id,
      ad: entegrasyonlar.ad,
      platform: entegrasyonlar.platform,
      saticiId: entegrasyonlar.saticiId,
    })
    .from(entegrasyonlar)
    .where(
      and(eq(entegrasyonlar.sirketId, sirketId), eq(entegrasyonlar.aktif, true)),
    )
    .orderBy(asc(entegrasyonlar.ad));

  return satirlar.map((s) => ({
    id: s.id,
    // Etiket verilmemişse mağaza satıcı kimliğiyle ayırt edilir.
    ad: s.ad ?? `${s.platform} ${s.saticiId}`,
    platform: s.platform,
  }));
}
