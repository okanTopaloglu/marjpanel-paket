import { and, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { siteOlaylari, type SiteOlayiTuru } from "@/lib/db/schema";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";

/**
 * SİTE OLAYLARI REPOSU — tanıtım sayfasının analitiği.
 *
 * Gün İSTANBUL günüdür (panelin geri kalanıyla aynı kural): sunucu UTC
 * koşuyor, gece 02:00'de gelen ziyaretçi "dün"e yazılırsa günlük grafik
 * kayar.
 */

const GUN = sql`(${siteOlaylari.createdAt} AT TIME ZONE ${ISTANBUL_TZ})::date`;

export interface OlayGirdisi {
  tur: SiteOlayiTuru;
  yol: string;
  etiket: string | null;
  yonlendiren: string | null;
  kaynak: string | null;
  kampanya: string | null;
  cihaz: string | null;
}

export async function olayYaz(g: OlayGirdisi): Promise<void> {
  await db.insert(siteOlaylari).values(g);
}

export interface SiteOzeti {
  /** Tür başına toplam (seçili pencere). */
  turBazinda: { tur: SiteOlayiTuru; adet: number }[];
  /** Günlük görüntüleme serisi. */
  gunlukSeri: { gun: string; goruntuleme: number; etkilesim: number }[];
  /** Yönlendiren alan adı kırılımı. */
  yonlendirenler: { ad: string; adet: number }[];
  /** Kampanya kırılımı (utm). */
  kampanyalar: { ad: string; adet: number }[];
  /** Cihaz kırılımı. */
  cihazlar: { ad: string; adet: number }[];
  /** Son tıklanan iletişim olayları. */
  sonIletisim: { tur: SiteOlayiTuru; etiket: string | null; zaman: Date }[];
  toplamGoruntuleme: number;
  toplamEtkilesim: number;
  /** Etkileşim / görüntüleme, yüzde. */
  donusumPct: number;
}

/** Görüntüleme dışındaki her olay bir "etkileşim"dir. */
const ETKILESIM = sql`${siteOlaylari.tur} <> 'goruntuleme'`;

export async function siteOzeti(gun = 30): Promise<SiteOzeti> {
  const baslangic = sql`now() - (${gun} * interval '1 day')`;
  const pencere = and(gte(siteOlaylari.createdAt, sql<Date>`${baslangic}`));

  const [turler, seri, yonlendirenler, kampanyalar, cihazlar, sonIletisim] = await Promise.all([
    db
      .select({ tur: siteOlaylari.tur, adet: sql<number>`count(*)::int` })
      .from(siteOlaylari)
      .where(pencere)
      .groupBy(siteOlaylari.tur),
    db
      .select({
        gun: sql<string>`${GUN}::text`,
        goruntuleme: sql<number>`count(*) filter (where ${siteOlaylari.tur} = 'goruntuleme')::int`,
        etkilesim: sql<number>`count(*) filter (where ${ETKILESIM})::int`,
      })
      .from(siteOlaylari)
      .where(pencere)
      .groupBy(GUN)
      .orderBy(GUN),
    db
      .select({ ad: sql<string>`coalesce(${siteOlaylari.yonlendiren}, 'doğrudan')`, adet: sql<number>`count(*)::int` })
      .from(siteOlaylari)
      .where(and(pencere, sql`${siteOlaylari.tur} = 'goruntuleme'`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(10),
    db
      .select({ ad: sql<string>`${siteOlaylari.kampanya}`, adet: sql<number>`count(*)::int` })
      .from(siteOlaylari)
      .where(and(pencere, sql`${siteOlaylari.kampanya} is not null`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(10),
    db
      .select({ ad: sql<string>`coalesce(${siteOlaylari.cihaz}, 'bilinmiyor')`, adet: sql<number>`count(*)::int` })
      .from(siteOlaylari)
      .where(and(pencere, sql`${siteOlaylari.tur} = 'goruntuleme'`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db
      .select({ tur: siteOlaylari.tur, etiket: siteOlaylari.etiket, zaman: siteOlaylari.createdAt })
      .from(siteOlaylari)
      .where(sql`${siteOlaylari.tur} in ('eposta', 'telefon', 'teklif')`)
      .orderBy(sql`${siteOlaylari.createdAt} desc`)
      .limit(20),
  ]);

  const turBazinda = turler.map((t) => ({ tur: t.tur, adet: t.adet }));
  const toplamGoruntuleme = turBazinda.find((t) => t.tur === "goruntuleme")?.adet ?? 0;
  const toplamEtkilesim = turBazinda.filter((t) => t.tur !== "goruntuleme").reduce((s, t) => s + t.adet, 0);

  return {
    turBazinda: turBazinda.sort((a, b) => b.adet - a.adet),
    gunlukSeri: seri,
    yonlendirenler,
    kampanyalar,
    cihazlar,
    sonIletisim,
    toplamGoruntuleme,
    toplamEtkilesim,
    donusumPct: toplamGoruntuleme > 0 ? Math.round((toplamEtkilesim / toplamGoruntuleme) * 1000) / 10 : 0,
  };
}
