import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pazaryeriSiparisleri } from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";
import { BEKLEYEN_DURUMLAR } from "@/lib/siparis/sabitler";
import { kalemleriCikar } from "@/lib/siparis/icerik-imzasi";
import {
  BAYAT_DAKIKA,
  BILINMEYEN_KARGO,
} from "@/lib/atama/sabitler";
import {
  gruplariSec,
  toplamaListesi,
  type ImzaGrubu,
  type ToplamaKalemi,
} from "@/lib/atama/secim";
import { barkodlarlaGetir } from "@/lib/db/repos/urunler";
import { barkodCoz } from "@/lib/db/repos/barkod-kurallari";
import { okutmaSatiriEkle } from "@/lib/db/repos/paketler";
import type { OkutmaKalemi } from "@/lib/okut/sonuc";

/**
 * TOPLAMA MODU (ATAMA) REPOSU - PartnerSys `assignment.controller.ts` portu.
 *
 * Akış: kargo firması seç → aynı içerikli siparişlerden ~20'lik bir grup
 * ATANIR → toplama listesi → tek tek paketle (barkod eşleşmesi zorunlu).
 *
 * İKİ KURAL BU DOSYANIN TAMAMINDA GEÇERLİDİR:
 *  1. Kiracı izolasyonu: her sorgunun İLK koşulu `sirket_id`'dir ve değeri
 *     yalnız `Kapsam`'dan gelir.
 *  2. Yarış güvenliği: atama tek UPDATE + `FOR UPDATE SKIP LOCKED` ile
 *     yapılır. İki çalışan aynı anda "Ata" derse ikisi de satır alır ama
 *     AYNI satırı almaz; kimse beklemez.
 */

/** Havuz koşulu: atanmayı bekleyen sipariş nedir (ham SQL sürümü). */
function havuzKosulu(sirketId: string, kargoFirmasi: string) {
  const durumlar = sql.join(
    BEKLEYEN_DURUMLAR.map((d) => sql`${d}`),
    sql`, `,
  );
  return sql`
      o.sirket_id = ${sirketId}
      AND o.hazir_zamani IS NULL
      AND o.durum IN (${durumlar})
      AND o.kargo_takip_no IS NOT NULL AND o.kargo_takip_no <> ''
      AND o.atanan_kullanici_id IS NULL
      AND (
        o.kargo_firmasi = ${kargoFirmasi}
        OR (${kargoFirmasi} = ${BILINMEYEN_KARGO} AND o.kargo_firmasi IS NULL)
      )`;
}

/**
 * 30 dakikadan eski, tamamlanmamış atamaları havuza döndürür.
 *
 * Neden zorunlu: çalışan paketleri üstüne alıp vardiyayı bitirirse ya da
 * tarayıcıyı kapatırsa o siparişler kimse tarafından hazırlanamaz hâle
 * gelirdi. Serbest bırakma her atama sorgusunun BAŞINDA çalışır - ayrı bir
 * zamanlayıcıya (cron) bağlı olmasın, tek kullanıcılı kurulumda da işlesin.
 */
export async function bayatlariSerbestBirak(sirketId: string): Promise<number> {
  const esik = new Date(Date.now() - BAYAT_DAKIKA * 60 * 1000);
  const satirlar = await db
    .update(pazaryeriSiparisleri)
    .set({ atananKullaniciId: null, atamaZamani: null })
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, sirketId),
        sql`${pazaryeriSiparisleri.atananKullaniciId} IS NOT NULL`,
        sql`${pazaryeriSiparisleri.atamaZamani} < ${esik}`,
        isNull(pazaryeriSiparisleri.hazirZamani),
      ),
    )
    .returning({ id: pazaryeriSiparisleri.id });
  return satirlar.length;
}

export interface KargoSecenegi {
  kargoFirmasi: string;
  adet: number;
}

/**
 * Havuzdaki siparişlerin kargo firması kırılımı - toplama modunun ilk adımı.
 * Kargo firması boş olan siparişler "Bilinmiyor" altında BİRLEŞTİRİLİR
 * (NULL ile 'Bilinmiyor' iki ayrı satır olarak düşmesin).
 */
export async function kargoFirmalari(
  sirketId: string,
): Promise<KargoSecenegi[]> {
  await bayatlariSerbestBirak(sirketId);

  const satirlar = await db
    .select({
      kargoFirmasi: pazaryeriSiparisleri.kargoFirmasi,
      adet: count(),
    })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, sirketId),
        isNull(pazaryeriSiparisleri.hazirZamani),
        sql`${pazaryeriSiparisleri.durum} IN (${sql.join(
          BEKLEYEN_DURUMLAR.map((d) => sql`${d}`),
          sql`, `,
        )})`,
        sql`${pazaryeriSiparisleri.kargoTakipNo} IS NOT NULL AND ${pazaryeriSiparisleri.kargoTakipNo} <> ''`,
        isNull(pazaryeriSiparisleri.atananKullaniciId),
      ),
    )
    .groupBy(pazaryeriSiparisleri.kargoFirmasi);

  const birlesik = new Map<string, number>();
  for (const s of satirlar) {
    const ad = s.kargoFirmasi?.trim() || BILINMEYEN_KARGO;
    birlesik.set(ad, (birlesik.get(ad) ?? 0) + s.adet);
  }

  return [...birlesik.entries()]
    .map(([kargoFirmasi, adet]) => ({ kargoFirmasi, adet }))
    .filter((s) => s.adet > 0)
    .sort((a, b) => b.adet - a.adet);
}

/**
 * Seçilen kargo firmasındaki havuzun içerik imzası kırılımı.
 *
 * PartnerSys burada her seferinde `jsonb_array_elements` ile imzayı YENİDEN
 * hesaplıyordu (tam tarama). Bizde imza upsert anında `icerik_imzasi`
 * sütununa yazılır ve kısmi indeks (`pazaryeri_siparisleri_toplama_idx`)
 * bu sorguyu karşılar.
 */
export async function imzaGruplari(
  sirketId: string,
  kargoFirmasi: string,
): Promise<ImzaGrubu[]> {
  const satirlar = await db.execute<{ imza: string; adet: number }>(sql`
    SELECT o.icerik_imzasi AS imza, COUNT(*)::int AS adet
    FROM pazaryeri_siparisleri o
    WHERE ${havuzKosulu(sirketId, kargoFirmasi)}
      AND o.icerik_imzasi IS NOT NULL
    GROUP BY o.icerik_imzasi
    ORDER BY adet DESC
  `);

  return [...satirlar].map((s) => ({ imza: s.imza, adet: Number(s.adet) }));
}

export type AtamaSonucu =
  /** Kullanıcının yarım kalmış ataması vardı; yeni paket VERİLMEZ. */
  | { sonuc: "devam"; adet: number }
  | { sonuc: "atandi"; adet: number }
  | { sonuc: "hata"; hata: "bos" | "baskasi_aldi" };

/**
 * PAKET ATA - toplama modunun kalbi.
 *
 * Sıra: bayatları bırak → açık atama var mı (varsa onunla devam) → içerik
 * gruplarını çek → saf seçim (`gruplariSec`) → ATOMİK claim.
 *
 * Claim tek UPDATE'tir: alt sorgu `FOR UPDATE SKIP LOCKED` ile kilitli
 * satırları atlar, böylece eşzamanlı iki çalışan birbirini beklemez ve aynı
 * paketi iki kez almaz. Hiç satır dönmezse başkası daha hızlı davranmıştır.
 */
export async function paketAta(
  k: Kapsam,
  kargoFirmasi: string,
): Promise<AtamaSonucu> {
  const sirketId = k.sirketId;
  await bayatlariSerbestBirak(sirketId);

  const [acik] = await db
    .select({ adet: count() })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, sirketId),
        eq(pazaryeriSiparisleri.atananKullaniciId, k.kullaniciId),
        isNull(pazaryeriSiparisleri.hazirZamani),
      ),
    );
  if ((acik?.adet ?? 0) > 0) {
    return { sonuc: "devam", adet: acik?.adet ?? 0 };
  }

  const gruplar = await imzaGruplari(sirketId, kargoFirmasi);
  if (gruplar.length === 0) return { sonuc: "hata", hata: "bos" };

  const secilenler = gruplariSec(gruplar);
  if (secilenler.length === 0) return { sonuc: "hata", hata: "bos" };

  const imzaListesi = sql.join(
    secilenler.map((imza) => sql`${imza}`),
    sql`, `,
  );

  const alinan = await db.execute<{ id: string }>(sql`
    UPDATE pazaryeri_siparisleri m
    SET atanan_kullanici_id = ${k.kullaniciId}, atama_zamani = now()
    WHERE m.id IN (
      SELECT o.id
      FROM pazaryeri_siparisleri o
      WHERE ${havuzKosulu(sirketId, kargoFirmasi)}
        AND o.icerik_imzasi IN (${imzaListesi})
      FOR UPDATE SKIP LOCKED
    )
    RETURNING m.id
  `);

  const adet = [...alinan].length;
  if (adet === 0) return { sonuc: "hata", hata: "baskasi_aldi" };
  return { sonuc: "atandi", adet };
}

export interface AtananSiparis {
  id: string;
  siparisNo: string | null;
  durum: string;
  kargoTakipNo: string | null;
  kargoFirmasi: string | null;
  kalemler: OkutmaKalemi[];
}

export interface AtamaListesi {
  siparisler: AtananSiparis[];
  toplamaListesi: ToplamaKalemi[];
}

/**
 * Çalışanın üstündeki paketler + gruplu toplama listesi.
 *
 * Ürün adı/görseli TEK sorguda çekilir (`barkodlarlaGetir`): 20 siparişlik
 * bir atamada satır başına sorgu atmak depo telefonunda saniyeler eder.
 */
export async function atamalarim(k: Kapsam): Promise<AtamaListesi> {
  const satirlar = await db
    .select({
      id: pazaryeriSiparisleri.id,
      siparisNo: pazaryeriSiparisleri.siparisNo,
      durum: pazaryeriSiparisleri.durum,
      kargoTakipNo: pazaryeriSiparisleri.kargoTakipNo,
      kargoFirmasi: pazaryeriSiparisleri.kargoFirmasi,
      hamVeri: pazaryeriSiparisleri.hamVeri,
    })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        eq(pazaryeriSiparisleri.atananKullaniciId, k.kullaniciId),
        isNull(pazaryeriSiparisleri.hazirZamani),
      ),
    )
    .orderBy(asc(pazaryeriSiparisleri.siparisTarihi));

  const hamKalemler = satirlar.map((s) => kalemleriCikar(s.hamVeri));
  const urunHaritasi = await barkodlarlaGetir(
    k.sirketId,
    hamKalemler.flat().map((l) => l.barkod),
  );

  const siparisler: AtananSiparis[] = satirlar.map((s, i) => ({
    id: s.id,
    siparisNo: s.siparisNo,
    durum: s.durum,
    kargoTakipNo: s.kargoTakipNo,
    kargoFirmasi: s.kargoFirmasi,
    kalemler: (hamKalemler[i] ?? []).map((l) => {
      const urun = urunHaritasi.get(l.barkod);
      return {
        barkod: l.barkod,
        urunAdi: l.urunAdi !== "-" ? l.urunAdi : (urun?.urunAdi ?? "-"),
        adet: l.adet,
        gorselUrl: urun?.gorselUrl ?? null,
      };
    }),
  }));

  return { siparisler, toplamaListesi: toplamaListesi(siparisler) };
}

/** Çalışan paketleri havuza geri verir (vardiya bitti, yanlış firma seçildi). */
export async function atamalariBirak(k: Kapsam): Promise<number> {
  const satirlar = await db
    .update(pazaryeriSiparisleri)
    .set({ atananKullaniciId: null, atamaZamani: null })
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        eq(pazaryeriSiparisleri.atananKullaniciId, k.kullaniciId),
        isNull(pazaryeriSiparisleri.hazirZamani),
      ),
    )
    .returning({ id: pazaryeriSiparisleri.id });
  return satirlar.length;
}

export type TamamlamaSonucu =
  | { sonuc: "tamam"; uyari?: "zaten_okutulmus" }
  | { sonuc: "bulunamadi" }
  | { sonuc: "iptal" }
  | { sonuc: "zaten_hazir" }
  | { sonuc: "atanmamis" }
  | { sonuc: "barkod_uyusmadi"; beklenen: string };

/**
 * PAKETİ TAMAMLA - okutulan barkod gösterilen siparişin kargo takip
 * numarasıyla BİREBİR eşleşmek zorundadır. Eşleşme kontrolü sunucudadır:
 * ekranda doğru sipariş dursa bile yanlış paketin etiketi okutulursa kayıt
 * düşmez. Depodaki asıl hata "doğru sipariş, yanlış kutu"dur.
 *
 * Tek işlem: siparişin hazır damgası ve paket okutma satırı birlikte yazılır.
 * Okutma satırı zaten varsa (paket hızlı modda okutulmuş) akış DURMAZ, yalnız
 * uyarı döner - sipariş yine hazır işaretlenir.
 */
export async function atamaTamamla(
  k: Kapsam,
  siparisId: string,
  barkod: string,
): Promise<TamamlamaSonucu> {
  const [siparis] = await db
    .select({
      id: pazaryeriSiparisleri.id,
      durum: pazaryeriSiparisleri.durum,
      hazirZamani: pazaryeriSiparisleri.hazirZamani,
      atananKullaniciId: pazaryeriSiparisleri.atananKullaniciId,
      kargoTakipNo: pazaryeriSiparisleri.kargoTakipNo,
      entegrasyonAdi: pazaryeriSiparisleri.entegrasyonAdi,
    })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        eq(pazaryeriSiparisleri.id, siparisId),
      ),
    )
    .limit(1);

  if (!siparis) return { sonuc: "bulunamadi" };
  if (siparis.durum === "Cancelled") return { sonuc: "iptal" };
  if (siparis.hazirZamani) return { sonuc: "zaten_hazir" };
  if (siparis.atananKullaniciId !== k.kullaniciId) return { sonuc: "atanmamis" };

  const beklenen = (siparis.kargoTakipNo ?? "").trim();
  const okutulan = barkod.trim();
  if (!beklenen || beklenen !== okutulan) {
    return { sonuc: "barkod_uyusmadi", beklenen };
  }

  const bilgi = await barkodCoz(k.sirketId, okutulan);

  return db.transaction(async (tx) => {
    await tx
      .update(pazaryeriSiparisleri)
      .set({ hazirZamani: new Date(), sonGuncelleme: new Date() })
      .where(
        and(
          eq(pazaryeriSiparisleri.sirketId, k.sirketId),
          eq(pazaryeriSiparisleri.id, siparis.id),
        ),
      );

    const { mukerrer } = await okutmaSatiriEkle(
      tx,
      k,
      okutulan,
      bilgi,
      siparis.entegrasyonAdi ?? null,
    );

    return mukerrer
      ? { sonuc: "tamam" as const, uyari: "zaten_okutulmus" as const }
      : { sonuc: "tamam" as const };
  });
}
