import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { kullanicilar, paketOkutmalari } from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";
import { gunAnahtari, gunAnahtariKaydir } from "@/lib/format/tarih";
import { buyumeYuzdesi } from "@/lib/pano/hesap";

/**
 * ÖZET (PANO) İSTATİSTİKLERİ - PartnerSys `getDashboardStats`,
 * `getAnalytics` ve `getAdvancedAnalytics` uçlarının portu.
 *
 * ÜÇ KURAL BU DOSYANIN TAMAMINDA GEÇERLİDİR:
 *
 * 1. GÜN İSTANBUL GÜNÜDÜR. Gruplamalar `AT TIME ZONE 'Europe/Istanbul'` ile
 *    yapılır. PartnerSys `DATE_TRUNC('day', "scannedAt")` diyordu, yani
 *    sunucunun UTC gününü; depo saat 02:00'de paket okuttuğunda o paket
 *    "dünün" kutusuna düşüyor, vardiya sayımı tutmuyordu.
 *
 * 2. KİRACI FİLTRESİ HER SORGUDA VARDIR ve `Kapsam`tan gelir. PartnerSys'te
 *    SUPER_ADMIN bütün şirketlerin sayılarını tek toplamda görüyordu; burada
 *    panel baştan sona tek kiracıya bakar (bkz. repos/paketler), platform
 *    genelinde toplam görmek ayrı bir yüzeyin işidir.
 *
 * 3. `calisan` YALNIZ KENDİ SATIRLARINI görür; kısıt sorguda uygulanır,
 *    arayüzde gizlemek yalnız süs olurdu.
 *
 * Kullanıcıdan gelen her değer (`${}`) parametre olarak bağlanır; hiçbir
 * yerde metin birleştirme yoktur.
 */

/** İstanbul takvim günü - gün bazlı her gruplamanın ortak ifadesi. */
const ISTANBUL_GUN = sql`(${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})::date`;

/** İstanbul yerel saati - ısı haritası gün/saat kırılımı. */
const ISTANBUL_YEREL = sql`(${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})`;

/** Kaynak/kargo boşsa arayüzde "Bilinmiyor" görünür (PartnerSys ile aynı). */
const BILINMIYOR = "Bilinmiyor";

/** Şirket + (çalışansa) kendi satırları. Her sorgunun ilk koşulu. */
function kapsamKosulu(k: Kapsam) {
  const sirket = eq(paketOkutmalari.sirketId, k.sirketId);
  return k.rol === "calisan"
    ? and(sirket, eq(paketOkutmalari.kullaniciId, k.kullaniciId))
    : sirket;
}

/** `[baslangic, bitis]` İstanbul günleri, iki uç DÂHİL. */
function aralikKosulu(k: Kapsam, baslangic: string, bitis: string) {
  return and(
    kapsamKosulu(k),
    sql`${ISTANBUL_GUN} between ${baslangic}::date and ${bitis}::date`,
  );
}

/** Son `gun` İstanbul günü (bugün dâhil). */
function songunKosulu(k: Kapsam, gun: number) {
  const bugun = gunAnahtari();
  return aralikKosulu(k, gunAnahtariKaydir(bugun, -(gun - 1)), bugun);
}

/** `gun` parametresi her zaman makul bir tam sayıya indirgenir. */
function gunSayisi(gun: number, varsayilan: number, azami = 366): number {
  const n = Math.round(Number(gun));
  if (!Number.isFinite(n) || n < 1) return varsayilan;
  return Math.min(azami, n);
}

/* ------------------------------------------------------------------ */
/* Aralık özeti                                                        */
/* ------------------------------------------------------------------ */

export interface CalisanPayi {
  kullaniciId: string;
  ad: string;
  profilGorsel: string | null;
  adet: number;
}

export interface KirilimPayi {
  etiket: string;
  adet: number;
}

export interface AralikOzeti {
  toplam: number;
  calisanBazinda: CalisanPayi[];
  kaynakBazinda: KirilimPayi[];
  kargoBazinda: KirilimPayi[];
}

/**
 * Seçili tarih aralığının özeti: toplam + çalışan / kaynak / kargo kırılımı.
 *
 * Çalışan adı `paket_okutmalari.okutan_ad`tan (denormalize) okunur, kullanıcı
 * tablosundan DEĞİL: hesabı silinen bir çalışanın geçmiş vardiyası listeden
 * düşmemeli. Profil görseli için yine de `left join` yapılır - varsa avatar
 * çıkar, yoksa baş harf.
 */
export async function aralikOzeti(
  k: Kapsam,
  baslangic: string,
  bitis: string,
): Promise<AralikOzeti> {
  const kosul = aralikKosulu(k, baslangic, bitis);

  const [calisan, kaynak, kargo] = await Promise.all([
    db
      .select({
        kullaniciId: paketOkutmalari.kullaniciId,
        ad: paketOkutmalari.okutanAd,
        profilGorsel: kullanicilar.profilGorsel,
        adet: sql<number>`count(*)::int`,
      })
      .from(paketOkutmalari)
      .leftJoin(kullanicilar, eq(kullanicilar.id, paketOkutmalari.kullaniciId))
      .where(kosul)
      .groupBy(
        paketOkutmalari.kullaniciId,
        paketOkutmalari.okutanAd,
        kullanicilar.profilGorsel,
      )
      .orderBy(sql`count(*) desc`),

    db
      .select({
        etiket: sql<string>`coalesce(nullif(${paketOkutmalari.kaynak}, ''), ${BILINMIYOR})`,
        adet: sql<number>`count(*)::int`,
      })
      .from(paketOkutmalari)
      .where(kosul)
      // SÜTUN SIRASIYLA gruplanır (`group by 1`). Aynı ifadeyi select ve
      // group by içinde tekrar yazmak Postgres'te ÇALIŞMAZ: her `${}` ayrı
      // bir parametre yer tutucusu ürettiği için sunucu iki ifadeyi eşit
      // saymaz ve "must appear in the GROUP BY clause" der.
      .groupBy(sql`1`)
      .orderBy(sql`count(*) desc`),

    db
      .select({
        etiket: sql<string>`coalesce(nullif(${paketOkutmalari.kargoFirmasi}, ''), ${BILINMIYOR})`,
        adet: sql<number>`count(*)::int`,
      })
      .from(paketOkutmalari)
      .where(kosul)
      .groupBy(sql`1`)
      .orderBy(sql`count(*) desc`),
  ]);

  return {
    // Toplam AYRI bir sorgu değil: çalışan kırılımı zaten bütün satırları
    // kapsıyor, ikinci bir count(*) aynı tabloyu bir kez daha tarardı.
    toplam: calisan.reduce((t, s) => t + s.adet, 0),
    calisanBazinda: calisan.map((s) => ({
      kullaniciId: s.kullaniciId,
      ad: s.ad,
      profilGorsel: s.profilGorsel ?? null,
      adet: s.adet,
    })),
    kaynakBazinda: kaynak,
    kargoBazinda: kargo,
  };
}

/* ------------------------------------------------------------------ */
/* Günlük seri                                                         */
/* ------------------------------------------------------------------ */

export interface GunlukNokta {
  /** `YYYY-MM-DD` (İstanbul takvim günü). */
  gun: string;
  adet: number;
}

/**
 * Son `gun` günün seri verisi. BOŞ GÜNLER 0 İLE DOLDURULUR: yalnız veri olan
 * günleri döndürmek, çubuk grafiği "hiç okutma olmayan gün" ile "grafikte
 * olmayan gün" arasında ayrım yapamaz hâle getirir ve sessiz günler grafikten
 * silinip seri yalan söylerdi.
 */
export async function gunlukSeri(k: Kapsam, gun = 14): Promise<GunlukNokta[]> {
  const adet = gunSayisi(gun, 14, 90);
  const bugun = gunAnahtari();

  const satirlar = await db
    .select({
      gun: sql<string>`to_char(${ISTANBUL_GUN}, 'YYYY-MM-DD')`,
      adet: sql<number>`count(*)::int`,
    })
    .from(paketOkutmalari)
    .where(songunKosulu(k, adet))
    .groupBy(sql`1`);

  const harita = new Map(satirlar.map((s) => [s.gun, s.adet]));
  const seri: GunlukNokta[] = [];
  for (let i = adet - 1; i >= 0; i -= 1) {
    const anahtar = gunAnahtariKaydir(bugun, -i);
    seri.push({ gun: anahtar, adet: harita.get(anahtar) ?? 0 });
  }
  return seri;
}

/* ------------------------------------------------------------------ */
/* Saatlik ısı haritası                                                */
/* ------------------------------------------------------------------ */

export interface IsiNoktasi {
  /** 0 = Pazar … 6 = Cumartesi (Postgres `dow`). */
  haftaGunu: number;
  /** 0-23, İstanbul yerel saati. */
  saat: number;
  adet: number;
}

/**
 * Hafta günü × saat yoğunluğu. Yalnız DOLU hücreler döner; 7×24'lük ızgarayı
 * arayüz kurar (168 satırın çoğu sıfır olurdu, ağdan taşımaya değmez).
 */
export async function saatlikIsiHaritasi(
  k: Kapsam,
  gun = 30,
): Promise<IsiNoktasi[]> {
  const adet = gunSayisi(gun, 30, 366);

  return db
    .select({
      haftaGunu: sql<number>`extract(dow from ${ISTANBUL_YEREL})::int`,
      saat: sql<number>`extract(hour from ${ISTANBUL_YEREL})::int`,
      adet: sql<number>`count(*)::int`,
    })
    .from(paketOkutmalari)
    .where(songunKosulu(k, adet))
    .groupBy(sql`1`, sql`2`)
    .orderBy(sql`1`, sql`2`);
}

/* ------------------------------------------------------------------ */
/* Gelişmiş özet                                                       */
/* ------------------------------------------------------------------ */

export interface GelismisOzet {
  /** Pencere toplamı. */
  toplam: number;
  /** Son 7 gün / önceki 7 gün değişimi, yüzde (tek ondalık). */
  haftalikBuyumePct: number;
  /** Pencere toplamı / gün sayısı (tek ondalık). */
  gunlukOrtalama: number;
  /** Pencere içinde en çok okutulan gün (hiç okutma yoksa null). */
  enIyiGun: GunlukNokta | null;
  /** Okutma OLAN günlerin en düşüğü (sıfır günler sayılmaz). */
  enKotuGun: GunlukNokta | null;
  sonHafta: number;
  oncekiHafta: number;
}

/**
 * `getAdvancedAnalytics` portu: haftalık büyüme, günlük ortalama, en iyi ve
 * en kötü gün.
 *
 * HAFTA PENCERELERİ TAKVİM GÜNÜYLE kurulur (son 7 İstanbul günü ve ondan
 * önceki 7 gün). PartnerSys `now() - 7 gün` diyordu; sorgu saat 09:00'da
 * koşunca "bugün" yarım, "8 gün önce" de yarım sayılıyor ve büyüme oranı
 * günün saatine göre oynuyordu.
 *
 * EN KÖTÜ GÜN, OKUTMA OLAN günlerin en düşüğüdür: sıfırlı günleri katmak her
 * yeni kurulumda "en kötü gün: 0" yazdırırdı, bilgi taşımaz.
 */
export async function gelismis(k: Kapsam, gun = 30): Promise<GelismisOzet> {
  const adet = gunSayisi(gun, 30, 366);
  const bugun = gunAnahtari();

  const gunler = await db
    .select({
      gun: sql<string>`to_char(${ISTANBUL_GUN}, 'YYYY-MM-DD')`,
      adet: sql<number>`count(*)::int`,
    })
    .from(paketOkutmalari)
    .where(songunKosulu(k, adet))
    .groupBy(sql`1`)
    .orderBy(sql`count(*) desc`);

  const toplam = gunler.reduce((t, s) => t + s.adet, 0);

  // Hafta pencereleri: son 7 gün [bugün-6, bugün], önceki 7 [bugün-13, bugün-7].
  const sonHaftaBas = gunAnahtariKaydir(bugun, -6);
  const oncekiBas = gunAnahtariKaydir(bugun, -13);
  const oncekiBitis = gunAnahtariKaydir(bugun, -7);

  let sonHafta = 0;
  let oncekiHafta = 0;
  for (const s of gunler) {
    if (s.gun >= sonHaftaBas && s.gun <= bugun) sonHafta += s.adet;
    else if (s.gun >= oncekiBas && s.gun <= oncekiBitis) oncekiHafta += s.adet;
  }

  return {
    toplam,
    haftalikBuyumePct: buyumeYuzdesi(sonHafta, oncekiHafta),
    gunlukOrtalama: Math.round((toplam / adet) * 10) / 10,
    enIyiGun: gunler[0] ?? null,
    enKotuGun: gunler.length > 0 ? (gunler[gunler.length - 1] ?? null) : null,
    sonHafta,
    oncekiHafta,
  };
}
