import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { kullanicilar, paketOkutmalari, sirketler } from "@/lib/db/schema";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";
import { gunAnahtari } from "@/lib/format/tarih";
import { donemAraligi, kesimHesapla, kurustanTl } from "@/lib/finans/hesap";
import { gecerliTarife, platformBakiyeleri, tarifeTanimi } from "./finans";
import { donemSarfGideri } from "./sarf";

/**
 * GENEL PANO (süper yönetici) — platform geneli: bugün/dönem paket, şirket
 * bazında gelir TAHMİNİ (dönem paketi × geçerli tarife; kesim yapılmamış
 * olabilir), sarf gideri (paket × norm × maliyet), kâr, bakiye; çalışan yükü.
 * `repos/istatistik` tek kiracıya bakar; bu dosya bilerek şirketler arası.
 */
const GUN = sql`(${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})::date`;

export interface SirketPanoSatiri {
  sirketId: string;
  sirketAd: string;
  bugun: number;
  donem: number;
  gelirTahmini: number | null;
  bakiye: string;
  gecikmis: number;
}

export interface CalisanYuku {
  kullaniciId: string;
  ad: string;
  sirketAd: string;
  bugun: number;
  donem: number;
  /** Dönemde çalışılan gün sayısı (en az bir okutma). */
  gun: number;
  /** Dönem paket / gün. */
  gunlukOrtalama: number;
}

export interface GenelPano {
  donem: string;
  bugunToplam: number;
  donemToplam: number;
  gelirTahmini: number;
  sarfGideri: number;
  karTahmini: number;
  toplamBakiye: number;
  sirketler: SirketPanoSatiri[];
  calisanlar: CalisanYuku[];
  /** Dönem gün × saat yoğunluğu (0-6 hafta günü, 0-23 saat). */
  saatlik: { gun: number; saat: number; adet: number }[];
}

export async function genelPano(donem: string): Promise<GenelPano> {
  const { baslangic, bitis } = donemAraligi(donem);
  const bugun = gunAnahtari();

  const [sirketSayimlari, calisanSayimlari, saatlik, bakiyeler] = await Promise.all([
    db
      .select({
        sirketId: sirketler.id,
        sirketAd: sirketler.ad,
        bugun: sql<number>`(select count(*) from ${paketOkutmalari} p where p.sirket_id = ${sirketler.id} and (p.okutma_zamani AT TIME ZONE ${ISTANBUL_TZ})::date = ${bugun}::date)::int`,
        donem: sql<number>`(select count(*) from ${paketOkutmalari} p where p.sirket_id = ${sirketler.id} and (p.okutma_zamani AT TIME ZONE ${ISTANBUL_TZ})::date between ${baslangic}::date and ${bitis}::date)::int`,
      })
      .from(sirketler)
      .orderBy(sirketler.ad),
    db
      .select({
        kullaniciId: kullanicilar.id,
        ad: kullanicilar.ad,
        sirketAd: sirketler.ad,
        bugun: sql<number>`count(*) filter (where ${GUN} = ${bugun}::date)::int`,
        donem: sql<number>`count(*)::int`,
        gun: sql<number>`count(distinct ${GUN})::int`,
      })
      .from(paketOkutmalari)
      .innerJoin(kullanicilar, sql`${kullanicilar.id} = ${paketOkutmalari.kullaniciId}`)
      .innerJoin(sirketler, sql`${sirketler.id} = ${kullanicilar.sirketId}`)
      .where(sql`${GUN} between ${baslangic}::date and ${bitis}::date`)
      .groupBy(kullanicilar.id, kullanicilar.ad, sirketler.ad)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        gun: sql<number>`extract(isodow from (${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ}))::int - 1`,
        saat: sql<number>`extract(hour from (${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ}))::int`,
        adet: sql<number>`count(*)::int`,
      })
      .from(paketOkutmalari)
      .where(sql`${GUN} between ${baslangic}::date and ${bitis}::date`)
      .groupBy(sql`1`, sql`2`),
    platformBakiyeleri(),
  ]);

  const tarifeler = await Promise.all(sirketSayimlari.map((s) => gecerliTarife(s.sirketId, baslangic)));
  const sirketSatirlari: SirketPanoSatiri[] = sirketSayimlari.map((s, i) => {
    const t = tarifeler[i];
    const b = bakiyeler.find((x) => x.sirketId === s.sirketId);
    const gelir = t ? kurustanTl(kesimHesapla(s.donem, tarifeTanimi(t)).genelToplamKurus) : null;
    return { ...s, gelirTahmini: gelir, bakiye: b?.bakiye ?? "0.00", gecikmis: b?.gecikmis ?? 0 };
  });

  const donemToplam = sirketSatirlari.reduce((t, s) => t + s.donem, 0);
  const gelirTahmini = Math.round(sirketSatirlari.reduce((t, s) => t + (s.gelirTahmini ?? 0), 0) * 100) / 100;
  const sarfGideri = await donemSarfGideri(donemToplam);

  return {
    donem,
    bugunToplam: sirketSatirlari.reduce((t, s) => t + s.bugun, 0),
    donemToplam,
    gelirTahmini,
    sarfGideri,
    karTahmini: Math.round((gelirTahmini - sarfGideri) * 100) / 100,
    toplamBakiye: Math.round(sirketSatirlari.reduce((t, s) => t + Number(s.bakiye), 0) * 100) / 100,
    sirketler: sirketSatirlari,
    calisanlar: calisanSayimlari.map((c) => ({ ...c, gunlukOrtalama: c.gun > 0 ? Math.round((c.donem / c.gun) * 10) / 10 : 0 })),
    saatlik,
  };
}
