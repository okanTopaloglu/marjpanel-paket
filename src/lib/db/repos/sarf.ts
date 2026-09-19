import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { paketOkutmalari, sarfHareketleri, sarfMalzemeleri, type SarfHareketi, type SarfMalzemesi } from "@/lib/db/schema";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";
import { sarfDurumu, sarfStogu, sarfTukenmeGun, sayimFarki, type SarfDurumu } from "@/lib/depo/sarf-hesap";

/**
 * SARF REPOSU — platform düzeyi (şirket yok). Tüketim türetilir:
 * norm × norm başlangıcından sonra TÜM şirketlerin okuttuğu paket.
 */
export interface SarfSatiri extends SarfMalzemesi {
  hareketToplami: number;
  normSonrasiPaket: number;
  son30Paket: number;
  stok: number;
  tukenmeGun: number | null;
  durum: SarfDurumu;
}

function sayilar(s: SarfMalzemesi, hareketToplami: number, normSonrasiPaket: number) {
  return {
    hareketToplami,
    paketBasiNorm: Number(s.paketBasiNorm),
    normSonrasiPaket,
    kritikSeviye: Number(s.kritikSeviye),
    birimMaliyet: Number(s.birimMaliyet),
  };
}

export async function listele(): Promise<SarfSatiri[]> {
  const satirlar = await db
    .select({
      s: sarfMalzemeleri,
      hareketToplami: sql<string>`coalesce((select sum(${sarfHareketleri.miktar}) from ${sarfHareketleri} where ${sarfHareketleri.sarfId} = ${sarfMalzemeleri.id}), 0)::text`,
      normSonrasiPaket: sql<number>`(select count(*) from ${paketOkutmalari} where (${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})::date >= ${sarfMalzemeleri.normBaslangic})::int`,
      son30Paket: sql<number>`(select count(*) from ${paketOkutmalari} where ${paketOkutmalari.okutmaZamani} > now() - interval '30 days')::int`,
    })
    .from(sarfMalzemeleri)
    .orderBy(desc(sarfMalzemeleri.aktif), sarfMalzemeleri.ad);

  return satirlar.map(({ s, hareketToplami, normSonrasiPaket, son30Paket }) => {
    const n = sayilar(s, Number(hareketToplami), normSonrasiPaket);
    const stok = sarfStogu(n);
    return {
      ...s,
      hareketToplami: Number(hareketToplami),
      normSonrasiPaket,
      son30Paket,
      stok,
      tukenmeGun: sarfTukenmeGun(stok, son30Paket, n.paketBasiNorm),
      durum: sarfDurumu(n),
    };
  });
}

export async function getir(id: string): Promise<SarfSatiri | null> {
  return (await listele()).find((s) => s.id === id) ?? null;
}

export async function hareketler(sarfId: string, limit = 50): Promise<SarfHareketi[]> {
  return db.select().from(sarfHareketleri).where(eq(sarfHareketleri.sarfId, sarfId)).orderBy(desc(sarfHareketleri.tarih), desc(sarfHareketleri.createdAt)).limit(limit);
}

export interface SarfGirdisi {
  ad: string;
  birim: string;
  birimMaliyet: number;
  paketBasiNorm: number;
  normBaslangic: string;
  kritikSeviye: number;
  aktif: boolean;
}

export async function kaydet(id: string | null, g: SarfGirdisi): Promise<string> {
  const degerler = {
    ad: g.ad,
    birim: g.birim,
    birimMaliyet: g.birimMaliyet.toFixed(4),
    paketBasiNorm: g.paketBasiNorm.toFixed(4),
    normBaslangic: g.normBaslangic,
    kritikSeviye: g.kritikSeviye.toFixed(2),
    aktif: g.aktif,
    updatedAt: new Date(),
  };
  if (id) {
    await db.update(sarfMalzemeleri).set(degerler).where(eq(sarfMalzemeleri.id, id));
    return id;
  }
  const [s] = await db.insert(sarfMalzemeleri).values(degerler).returning({ id: sarfMalzemeleri.id });
  if (!s) throw new Error("Sarf malzemesi kaydedilemedi.");
  return s.id;
}

export async function sil(id: string): Promise<boolean> {
  const s = await db.delete(sarfMalzemeleri).where(eq(sarfMalzemeleri.id, id)).returning({ id: sarfMalzemeleri.id });
  return s.length > 0;
}

/**
 * Hareket ekler. `sayim` türünde `miktar` SAYILAN değerdir; kaydedilen fark.
 * Alımda `tutar` verilirse birim maliyet güncellenir (tutar / miktar).
 */
export async function hareketEkle(g: {
  sarfId: string;
  tur: "alim" | "sayim" | "duzeltme";
  miktar: number;
  tutar: number | null;
  tarih: string;
  not: string | null;
  kaydedenAd: string;
}): Promise<{ kaydedilen: number }> {
  const s = await getir(g.sarfId);
  if (!s) throw new Error("Sarf malzemesi bulunamadı.");

  let kaydedilen = g.miktar;
  if (g.tur === "sayim") {
    kaydedilen = sayimFarki(sayilar(s, s.hareketToplami, s.normSonrasiPaket), g.miktar);
  }

  await db.transaction(async (tx) => {
    await tx.insert(sarfHareketleri).values({
      sarfId: g.sarfId,
      tur: g.tur,
      miktar: kaydedilen.toFixed(2),
      tutar: g.tutar === null ? null : g.tutar.toFixed(2),
      tarih: g.tarih,
      not: g.not,
      kaydedenAd: g.kaydedenAd,
    });
    if (g.tur === "alim" && g.tutar !== null && g.miktar > 0) {
      await tx
        .update(sarfMalzemeleri)
        .set({ birimMaliyet: (g.tutar / g.miktar).toFixed(4), updatedAt: new Date() })
        .where(eq(sarfMalzemeleri.id, g.sarfId));
    }
  });
  return { kaydedilen };
}

/** Dönem sarf gideri (TL): tüm aktif sarflar için paket × norm × maliyet. */
export async function donemSarfGideri(paketSayisi: number): Promise<number> {
  const liste = await db.select().from(sarfMalzemeleri).where(eq(sarfMalzemeleri.aktif, true));
  return Math.round(liste.reduce((t, s) => t + paketSayisi * Number(s.paketBasiNorm) * Number(s.birimMaliyet), 0) * 100) / 100;
}
