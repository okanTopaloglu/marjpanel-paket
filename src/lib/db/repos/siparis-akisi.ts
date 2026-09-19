import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { pazaryeriSiparisleri } from "@/lib/db/schema";
import { ISTANBUL_TZ, NIHAI_DURUMLAR } from "@/lib/siparis/sabitler";
import { kesimAniSql } from "@/lib/siparis/sekme-sql";

/**
 * SİPARİŞ AKIŞI (ana ekran kartları) — dört sayı, her biri entegrasyon
 * kırılımıyla:
 *
 *  gelen         sipariş tarihi aralıkta (pazaryerinden düşen sipariş)
 *  hazirlanan    hazır zamanı aralıkta (depoda okutulup hazır işaretlenen)
 *  kargoyaVerilen kargo zamanı aralıkta (pazaryeri "kargoda/teslim" dedi)
 *  sevkGereken   ŞU AN: nihai olmayan ve sipariş tarihi bugünkü kesim
 *                saatinden önce olan — bugün mutlaka çıkmalı. Aralıktan
 *                bağımsızdır; dünün kalanları da buradadır.
 *
 * Günler İstanbul günüdür; `kesimSaati` şirketin sevk kesim saati.
 */
export interface AkisKirilimi {
  ad: string;
  adet: number;
}

export interface AkisSayaci {
  toplam: number;
  kirilim: AkisKirilimi[];
}

export interface SiparisAkisi {
  gelen: AkisSayaci;
  hazirlanan: AkisSayaci;
  kargoyaVerilen: AkisSayaci;
  sevkGereken: AkisSayaci;
  /** Kesimden sonra gelmiş, nihai olmayan: yarının işi. */
  kesimSonrasi: number;
  kesimSaati: number;
}

const NIHAI_LISTE = sql.raw(NIHAI_DURUMLAR.map((d) => `'${d}'`).join(", "));

function gunKosulu(sutun: AnyPgColumn, baslangic: string, bitis: string) {
  return sql`(${sutun} AT TIME ZONE ${ISTANBUL_TZ})::date between ${baslangic}::date and ${bitis}::date`;
}

async function sayac(kosul: ReturnType<typeof and>): Promise<AkisSayaci> {
  const satirlar = await db
    .select({ ad: pazaryeriSiparisleri.entegrasyonAdi, adet: sql<number>`count(*)::int` })
    .from(pazaryeriSiparisleri)
    .where(kosul)
    .groupBy(pazaryeriSiparisleri.entegrasyonAdi);
  const kirilim = satirlar
    .map((s) => ({ ad: s.ad?.trim() || "Bilinmiyor", adet: s.adet }))
    .sort((a, b) => b.adet - a.adet);
  return { toplam: kirilim.reduce((t, k) => t + k.adet, 0), kirilim };
}

export async function siparisAkisi(
  sirketId: string,
  baslangic: string,
  bitis: string,
  kesimSaati: number,
): Promise<SiparisAkisi> {
  const sirket = eq(pazaryeriSiparisleri.sirketId, sirketId);
  const kesim = sql.raw(kesimAniSql(kesimSaati));
  const acik = sql`${pazaryeriSiparisleri.durum} not in (${NIHAI_LISTE})`;

  const [gelen, hazirlanan, kargoyaVerilen, sevkGereken, [sonrasi]] = await Promise.all([
    sayac(and(sirket, gunKosulu(pazaryeriSiparisleri.siparisTarihi, baslangic, bitis))),
    sayac(and(sirket, gunKosulu(pazaryeriSiparisleri.hazirZamani, baslangic, bitis))),
    sayac(and(sirket, gunKosulu(pazaryeriSiparisleri.kargoZamani, baslangic, bitis))),
    sayac(and(sirket, acik, sql`${pazaryeriSiparisleri.siparisTarihi} is not null and ${pazaryeriSiparisleri.siparisTarihi} < ${kesim}`)),
    db
      .select({ adet: sql<number>`count(*)::int` })
      .from(pazaryeriSiparisleri)
      .where(and(sirket, acik, sql`${pazaryeriSiparisleri.siparisTarihi} >= ${kesim}`)),
  ]);

  return { gelen, hazirlanan, kargoyaVerilen, sevkGereken, kesimSonrasi: sonrasi?.adet ?? 0, kesimSaati };
}
