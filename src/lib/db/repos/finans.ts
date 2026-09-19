import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  hesapKesimKalemleri,
  hesapKesimleri,
  odemeler,
  paketOkutmalari,
  sirketler,
  tarifeler,
  type HesapKesimKalemi,
  type HesapKesimi,
  type KesimDurumu,
  type Odeme,
  type Tarife,
} from "@/lib/db/schema";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";
import {
  donemAraligi,
  ekHizmetleriDuzenle,
  kademeleriDuzenle,
  kurusMetni,
  type KademeTipi,
  type KesimSonucu,
  type TarifeTanimi,
} from "@/lib/finans/hesap";

/**
 * FİNANS REPOSU — tarife, hesap kesimi, ödeme, bakiye.
 *
 * Paket sayısı `paket_okutmalari`ndan, İstanbul takvim ayına göre sayılır
 * (istatistik reposuyla aynı kural). Kesim tutarları kesim anında kalemlere
 * yazılır; tarife sonradan değişse de eski kesim değişmez.
 */

/* ------------------------------------------------------------------ */
/* Tarife                                                              */
/* ------------------------------------------------------------------ */

export function tarifeTanimi(t: Tarife): TarifeTanimi {
  return {
    kademeTipi: t.kademeTipi === "dilimli" ? "dilimli" : "toplam",
    kademeler: kademeleriDuzenle(t.kademeler),
    ekHizmetler: ekHizmetleriDuzenle(t.ekHizmetler),
    kdvOrani: Number(t.kdvOrani),
  };
}

export async function tarifeler_(sirketId: string): Promise<Tarife[]> {
  return db.select().from(tarifeler).where(eq(tarifeler.sirketId, sirketId)).orderBy(desc(tarifeler.gecerlilikBaslangic));
}

/** `tarih` (YYYY-MM-DD) itibarıyla geçerli en son tarife. */
export async function gecerliTarife(sirketId: string, tarih: string): Promise<Tarife | null> {
  const [t] = await db
    .select()
    .from(tarifeler)
    .where(and(eq(tarifeler.sirketId, sirketId), lte(tarifeler.gecerlilikBaslangic, tarih)))
    .orderBy(desc(tarifeler.gecerlilikBaslangic), desc(tarifeler.createdAt))
    .limit(1);
  return t ?? null;
}

export async function tarifeKaydet(g: {
  sirketId: string;
  gecerlilikBaslangic: string;
  kademeTipi: KademeTipi;
  kademeler: unknown;
  ekHizmetler: unknown;
  kdvOrani: number;
  not: string | null;
  kaydedenAd: string;
}): Promise<string> {
  const [t] = await db
    .insert(tarifeler)
    .values({
      sirketId: g.sirketId,
      gecerlilikBaslangic: g.gecerlilikBaslangic,
      kademeTipi: g.kademeTipi,
      kademeler: kademeleriDuzenle(g.kademeler),
      ekHizmetler: ekHizmetleriDuzenle(g.ekHizmetler),
      kdvOrani: String(g.kdvOrani),
      not: g.not,
      kaydedenAd: g.kaydedenAd,
    })
    .returning({ id: tarifeler.id });
  if (!t) throw new Error("Tarife kaydedilemedi.");
  return t.id;
}

export async function tarifeSil(id: string): Promise<boolean> {
  const s = await db.delete(tarifeler).where(eq(tarifeler.id, id)).returning({ id: tarifeler.id });
  return s.length > 0;
}

/* ------------------------------------------------------------------ */
/* Dönem paket sayısı                                                  */
/* ------------------------------------------------------------------ */

/** Şirketin dönemde okuttuğu paket sayısı (İstanbul ayı). */
export async function donemPaketSayisi(sirketId: string, donem: string): Promise<number> {
  const { baslangic, bitis } = donemAraligi(donem);
  const [s] = await db
    .select({ adet: sql<number>`count(*)::int` })
    .from(paketOkutmalari)
    .where(
      and(
        eq(paketOkutmalari.sirketId, sirketId),
        sql`(${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})::date between ${baslangic}::date and ${bitis}::date`,
      ),
    );
  return s?.adet ?? 0;
}

/** Tüm şirketler için dönem paket sayısı (tek sorgu). */
export async function donemPaketSayilari(donem: string): Promise<Map<string, number>> {
  const { baslangic, bitis } = donemAraligi(donem);
  const satirlar = await db
    .select({ sirketId: paketOkutmalari.sirketId, adet: sql<number>`count(*)::int` })
    .from(paketOkutmalari)
    .where(sql`(${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})::date between ${baslangic}::date and ${bitis}::date`)
    .groupBy(paketOkutmalari.sirketId);
  return new Map(satirlar.map((s) => [s.sirketId, s.adet]));
}

/* ------------------------------------------------------------------ */
/* Hesap kesimi                                                        */
/* ------------------------------------------------------------------ */

export interface KesimSatiri extends HesapKesimi {
  sirketAd: string;
  odenen: string;
}

export interface KesimDetayi extends KesimSatiri {
  kalemler: HesapKesimKalemi[];
  odemeler: Odeme[];
}

const ODENEN_ALT = sql<string>`coalesce((select sum(${odemeler.tutar}) from ${odemeler} where ${odemeler.kesimId} = ${hesapKesimleri.id}), 0)::text`;

export async function kesimler(sirketId?: string, donem?: string): Promise<KesimSatiri[]> {
  const kosullar = [] as ReturnType<typeof eq>[];
  if (sirketId) kosullar.push(eq(hesapKesimleri.sirketId, sirketId));
  if (donem) kosullar.push(eq(hesapKesimleri.donem, donem));
  return db
    .select({
      id: hesapKesimleri.id,
      sirketId: hesapKesimleri.sirketId,
      donem: hesapKesimleri.donem,
      durum: hesapKesimleri.durum,
      paketSayisi: hesapKesimleri.paketSayisi,
      araToplam: hesapKesimleri.araToplam,
      kdvOrani: hesapKesimleri.kdvOrani,
      kdvTutari: hesapKesimleri.kdvTutari,
      genelToplam: hesapKesimleri.genelToplam,
      faturaNo: hesapKesimleri.faturaNo,
      kesimTarihi: hesapKesimleri.kesimTarihi,
      vadeTarihi: hesapKesimleri.vadeTarihi,
      not: hesapKesimleri.not,
      kaydedenAd: hesapKesimleri.kaydedenAd,
      createdAt: hesapKesimleri.createdAt,
      updatedAt: hesapKesimleri.updatedAt,
      sirketAd: sirketler.ad,
      odenen: ODENEN_ALT,
    })
    .from(hesapKesimleri)
    .innerJoin(sirketler, eq(sirketler.id, hesapKesimleri.sirketId))
    .where(kosullar.length ? and(...kosullar) : undefined)
    .orderBy(desc(hesapKesimleri.donem), sirketler.ad);
}

export async function kesimGetir(id: string, sirketId?: string): Promise<KesimDetayi | null> {
  const liste = await db
    .select({
      id: hesapKesimleri.id,
      sirketId: hesapKesimleri.sirketId,
      donem: hesapKesimleri.donem,
      durum: hesapKesimleri.durum,
      paketSayisi: hesapKesimleri.paketSayisi,
      araToplam: hesapKesimleri.araToplam,
      kdvOrani: hesapKesimleri.kdvOrani,
      kdvTutari: hesapKesimleri.kdvTutari,
      genelToplam: hesapKesimleri.genelToplam,
      faturaNo: hesapKesimleri.faturaNo,
      kesimTarihi: hesapKesimleri.kesimTarihi,
      vadeTarihi: hesapKesimleri.vadeTarihi,
      not: hesapKesimleri.not,
      kaydedenAd: hesapKesimleri.kaydedenAd,
      createdAt: hesapKesimleri.createdAt,
      updatedAt: hesapKesimleri.updatedAt,
      sirketAd: sirketler.ad,
      odenen: ODENEN_ALT,
    })
    .from(hesapKesimleri)
    .innerJoin(sirketler, eq(sirketler.id, hesapKesimleri.sirketId))
    .where(sirketId ? and(eq(hesapKesimleri.id, id), eq(hesapKesimleri.sirketId, sirketId)) : eq(hesapKesimleri.id, id))
    .limit(1);
  const k = liste[0];
  if (!k) return null;
  const [kalemler, odemeListesi] = await Promise.all([
    db.select().from(hesapKesimKalemleri).where(eq(hesapKesimKalemleri.kesimId, id)).orderBy(hesapKesimKalemleri.sira),
    db.select().from(odemeler).where(eq(odemeler.kesimId, id)).orderBy(desc(odemeler.tarih)),
  ]);
  return { ...k, kalemler, odemeler: odemeListesi };
}

/**
 * Taslak oluşturur ya da MEVCUT TASLAĞI yeniden hesaplar (aynı şirket+dönem).
 * Kesilmiş kesim değiştirilmez — önce iptal edilmeli.
 */
export async function kesimTaslakYaz(g: {
  sirketId: string;
  donem: string;
  paketSayisi: number;
  sonuc: KesimSonucu;
  not: string | null;
  kaydedenAd: string;
}): Promise<{ id: string; yeniden: boolean }> {
  return db.transaction(async (tx) => {
    const [mevcut] = await tx
      .select({ id: hesapKesimleri.id, durum: hesapKesimleri.durum })
      .from(hesapKesimleri)
      .where(and(eq(hesapKesimleri.sirketId, g.sirketId), eq(hesapKesimleri.donem, g.donem)))
      .limit(1);
    if (mevcut && mevcut.durum !== "taslak" && mevcut.durum !== "iptal") {
      throw new Error("Bu dönem için kesim zaten kesilmiş; değiştirmek için önce iptal edin.");
    }

    const alanlar = {
      paketSayisi: g.paketSayisi,
      araToplam: kurusMetni(g.sonuc.araToplamKurus),
      kdvOrani: String(g.sonuc.kdvOrani),
      kdvTutari: kurusMetni(g.sonuc.kdvKurus),
      genelToplam: kurusMetni(g.sonuc.genelToplamKurus),
      not: g.not,
      kaydedenAd: g.kaydedenAd,
      durum: "taslak" as KesimDurumu,
      faturaNo: null,
      kesimTarihi: null,
      vadeTarihi: null,
      updatedAt: new Date(),
    };

    let id: string;
    if (mevcut) {
      await tx.update(hesapKesimleri).set(alanlar).where(eq(hesapKesimleri.id, mevcut.id));
      await tx.delete(hesapKesimKalemleri).where(eq(hesapKesimKalemleri.kesimId, mevcut.id));
      id = mevcut.id;
    } else {
      const [k] = await tx
        .insert(hesapKesimleri)
        .values({ sirketId: g.sirketId, donem: g.donem, ...alanlar })
        .returning({ id: hesapKesimleri.id });
      if (!k) throw new Error("Kesim oluşturulamadı.");
      id = k.id;
    }

    if (g.sonuc.kalemler.length) {
      await tx.insert(hesapKesimKalemleri).values(
        g.sonuc.kalemler.map((k, i) => ({
          kesimId: id,
          sira: i,
          tur: k.tur,
          aciklama: k.aciklama,
          adet: String(k.adet),
          birimFiyat: kurusMetni(k.birimFiyatKurus),
          tutar: kurusMetni(k.tutarKurus),
        })),
      );
    }
    return { id, yeniden: !!mevcut };
  });
}

export async function kesimDurumu(
  id: string,
  g: { durum: KesimDurumu; faturaNo?: string | null; vadeTarihi?: string | null },
): Promise<void> {
  await db
    .update(hesapKesimleri)
    .set({
      durum: g.durum,
      ...(g.faturaNo !== undefined ? { faturaNo: g.faturaNo } : {}),
      ...(g.vadeTarihi !== undefined ? { vadeTarihi: g.vadeTarihi } : {}),
      ...(g.durum === "kesildi" ? { kesimTarihi: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(hesapKesimleri.id, id));
}

export async function kesimSil(id: string): Promise<boolean> {
  const s = await db
    .delete(hesapKesimleri)
    .where(and(eq(hesapKesimleri.id, id), eq(hesapKesimleri.durum, "taslak")))
    .returning({ id: hesapKesimleri.id });
  return s.length > 0;
}

/* ------------------------------------------------------------------ */
/* Ödeme ve bakiye                                                     */
/* ------------------------------------------------------------------ */

export async function odemeEkle(g: {
  sirketId: string;
  kesimId: string | null;
  tarih: string;
  tutar: number;
  yontem: string;
  not: string | null;
  kaydedenAd: string;
}): Promise<string> {
  return db.transaction(async (tx) => {
    const [o] = await tx
      .insert(odemeler)
      .values({ ...g, tutar: g.tutar.toFixed(2) })
      .returning({ id: odemeler.id });
    if (!o) throw new Error("Ödeme kaydedilemedi.");
    // Kesime bağlı ödeme genel toplamı karşıladıysa kesim "ödendi".
    if (g.kesimId) {
      const [k] = await tx
        .select({
          genel: hesapKesimleri.genelToplam,
          odenen: sql<string>`coalesce((select sum(${odemeler.tutar}) from ${odemeler} where ${odemeler.kesimId} = ${hesapKesimleri.id}), 0)::text`,
          durum: hesapKesimleri.durum,
        })
        .from(hesapKesimleri)
        .where(eq(hesapKesimleri.id, g.kesimId))
        .limit(1);
      if (k && k.durum === "kesildi" && Number(k.odenen) + 0.005 >= Number(k.genel)) {
        await tx.update(hesapKesimleri).set({ durum: "odendi", updatedAt: new Date() }).where(eq(hesapKesimleri.id, g.kesimId));
      }
    }
    return o.id;
  });
}

export async function odemeler_(sirketId: string): Promise<(Odeme & { donem: string | null })[]> {
  return db
    .select({
      id: odemeler.id,
      sirketId: odemeler.sirketId,
      kesimId: odemeler.kesimId,
      tarih: odemeler.tarih,
      tutar: odemeler.tutar,
      yontem: odemeler.yontem,
      not: odemeler.not,
      kaydedenAd: odemeler.kaydedenAd,
      createdAt: odemeler.createdAt,
      donem: hesapKesimleri.donem,
    })
    .from(odemeler)
    .leftJoin(hesapKesimleri, eq(hesapKesimleri.id, odemeler.kesimId))
    .where(eq(odemeler.sirketId, sirketId))
    .orderBy(desc(odemeler.tarih), desc(odemeler.createdAt));
}

export interface BakiyeOzeti {
  /** Kesilmiş (kesildi + ödendi) toplam, TL metni. */
  kesilen: string;
  odenen: string;
  bakiye: string;
  /** Vadesi geçmiş ve ödenmemiş kesim sayısı. */
  gecikmis: number;
}

export async function bakiyeOzeti(sirketId: string): Promise<BakiyeOzeti> {
  const [k] = await db
    .select({
      kesilen: sql<string>`coalesce(sum(${hesapKesimleri.genelToplam}) filter (where ${hesapKesimleri.durum} in ('kesildi','odendi')), 0)::text`,
      gecikmis: sql<number>`count(*) filter (where ${hesapKesimleri.durum} = 'kesildi' and ${hesapKesimleri.vadeTarihi} < current_date)::int`,
    })
    .from(hesapKesimleri)
    .where(eq(hesapKesimleri.sirketId, sirketId));
  const [o] = await db
    .select({ odenen: sql<string>`coalesce(sum(${odemeler.tutar}), 0)::text` })
    .from(odemeler)
    .where(eq(odemeler.sirketId, sirketId));
  const kesilen = Number(k?.kesilen ?? 0);
  const odenen = Number(o?.odenen ?? 0);
  return { kesilen: kesilen.toFixed(2), odenen: odenen.toFixed(2), bakiye: (kesilen - odenen).toFixed(2), gecikmis: k?.gecikmis ?? 0 };
}

export interface PlatformFinansSatiri {
  sirketId: string;
  sirketAd: string;
  kesilen: string;
  odenen: string;
  bakiye: string;
  gecikmis: number;
}

/** Süper yönetici: şirket başına alacak/bakiye (tek sorgu). */
export async function platformBakiyeleri(): Promise<PlatformFinansSatiri[]> {
  const satirlar = await db
    .select({
      sirketId: sirketler.id,
      sirketAd: sirketler.ad,
      kesilen: sql<string>`coalesce((select sum(${hesapKesimleri.genelToplam}) from ${hesapKesimleri} where ${hesapKesimleri.sirketId} = ${sirketler.id} and ${hesapKesimleri.durum} in ('kesildi','odendi')), 0)::text`,
      odenen: sql<string>`coalesce((select sum(${odemeler.tutar}) from ${odemeler} where ${odemeler.sirketId} = ${sirketler.id}), 0)::text`,
      gecikmis: sql<number>`(select count(*) from ${hesapKesimleri} where ${hesapKesimleri.sirketId} = ${sirketler.id} and ${hesapKesimleri.durum} = 'kesildi' and ${hesapKesimleri.vadeTarihi} < current_date)::int`,
    })
    .from(sirketler)
    .orderBy(sirketler.ad);
  return satirlar.map((s) => ({ ...s, bakiye: (Number(s.kesilen) - Number(s.odenen)).toFixed(2) }));
}
