import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  malKabulKalemleri,
  malKabuller,
  sirketler,
  urunler,
  type MalKabul,
  type MalKabulKalemi,
  type MalKabulTuru,
} from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";
import type { KalemGirdisi } from "@/lib/depo/kalem-ayristir";

/**
 * MAL KABUL REPOSU — fiş + kalemler. Yalnız super_admin yazar (depo
 * MarjPanel'indir); kiracı admini kendi şirketinin fişlerini OKUR.
 */

export interface MalKabulSatiri extends MalKabul {
  sirketAd: string;
}

export const SAYFA_LIMITI = 30;

/** Fiş listesi; `sirketId` verilirse tek şirket (kiracı görünümü). */
export async function listele(
  { sirketId, sayfa = 0, limit = SAYFA_LIMITI }: { sirketId?: string; sayfa?: number; limit?: number },
): Promise<{ satirlar: MalKabulSatiri[]; toplam: number }> {
  const kosul = sirketId ? eq(malKabuller.sirketId, sirketId) : undefined;
  const [satirlar, [sayim]] = await Promise.all([
    db
      .select({
        id: malKabuller.id,
        sirketId: malKabuller.sirketId,
        tur: malKabuller.tur,
        tarih: malKabuller.tarih,
        irsaliyeNo: malKabuller.irsaliyeNo,
        not: malKabuller.not,
        kaydedenId: malKabuller.kaydedenId,
        kaydedenAd: malKabuller.kaydedenAd,
        kalemSayisi: malKabuller.kalemSayisi,
        toplamAdet: malKabuller.toplamAdet,
        createdAt: malKabuller.createdAt,
        updatedAt: malKabuller.updatedAt,
        sirketAd: sirketler.ad,
      })
      .from(malKabuller)
      .innerJoin(sirketler, eq(sirketler.id, malKabuller.sirketId))
      .where(kosul)
      .orderBy(desc(malKabuller.tarih), desc(malKabuller.createdAt))
      .limit(limit)
      .offset(sayfa * limit),
    db.select({ adet: sql<number>`count(*)::int` }).from(malKabuller).where(kosul),
  ]);
  return { satirlar, toplam: sayim?.adet ?? 0 };
}

export interface MalKabulDetayi extends MalKabulSatiri {
  kalemler: MalKabulKalemi[];
}

/** Tek fiş; `sirketId` verilirse o şirketle sınırlı (kiracı kendi fişini görür). */
export async function getir(id: string, sirketId?: string): Promise<MalKabulDetayi | null> {
  const [fis] = await db
    .select({
      id: malKabuller.id,
      sirketId: malKabuller.sirketId,
      tur: malKabuller.tur,
      tarih: malKabuller.tarih,
      irsaliyeNo: malKabuller.irsaliyeNo,
      not: malKabuller.not,
      kaydedenId: malKabuller.kaydedenId,
      kaydedenAd: malKabuller.kaydedenAd,
      kalemSayisi: malKabuller.kalemSayisi,
      toplamAdet: malKabuller.toplamAdet,
      createdAt: malKabuller.createdAt,
      updatedAt: malKabuller.updatedAt,
      sirketAd: sirketler.ad,
    })
    .from(malKabuller)
    .innerJoin(sirketler, eq(sirketler.id, malKabuller.sirketId))
    .where(sirketId ? and(eq(malKabuller.id, id), eq(malKabuller.sirketId, sirketId)) : eq(malKabuller.id, id))
    .limit(1);
  if (!fis) return null;
  const kalemler = await db
    .select()
    .from(malKabulKalemleri)
    .where(eq(malKabulKalemleri.malKabulId, id))
    .orderBy(malKabulKalemleri.barkod);
  return { ...fis, kalemler };
}

export interface OlusturGirdisi {
  sirketId: string;
  tur: MalKabulTuru;
  tarih: Date;
  irsaliyeNo: string | null;
  not: string | null;
  /** İşaretli stok etkisi (iade için çağıran eksiye çevirir). */
  kalemler: KalemGirdisi[];
}

/**
 * Fiş + kalemler TEK TRANSACTION'da. Ürün adı katalogdan o an kopyalanır
 * (snapshot); katalogda olmayan barkod da kabul edilir — depo malı sayar,
 * kataloğu sonra tamamlar.
 */
export async function olustur(k: Kapsam, g: OlusturGirdisi): Promise<string> {
  const barkodlar = g.kalemler.map((x) => x.barkod);
  const adlar = new Map<string, string | null>();
  if (barkodlar.length) {
    const satirlar = await db
      .select({ barkod: urunler.barkod, ad: urunler.urunAdi })
      .from(urunler)
      .where(and(eq(urunler.sirketId, g.sirketId), inArray(urunler.barkod, barkodlar)));
    for (const s of satirlar) adlar.set(s.barkod, s.ad);
  }

  return db.transaction(async (tx) => {
    const [fis] = await tx
      .insert(malKabuller)
      .values({
        sirketId: g.sirketId,
        tur: g.tur,
        tarih: g.tarih,
        irsaliyeNo: g.irsaliyeNo,
        not: g.not,
        kaydedenId: k.kullaniciId,
        kaydedenAd: k.ad,
        kalemSayisi: g.kalemler.length,
        toplamAdet: g.kalemler.reduce((t, x) => t + x.adet, 0),
      })
      .returning({ id: malKabuller.id });
    if (!fis) throw new Error("Fiş oluşturulamadı.");
    if (g.kalemler.length) {
      await tx.insert(malKabulKalemleri).values(
        g.kalemler.map((x) => ({
          malKabulId: fis.id,
          sirketId: g.sirketId,
          barkod: x.barkod,
          adet: x.adet,
          urunAdi: adlar.get(x.barkod) ?? null,
        })),
      );
    }
    return fis.id;
  });
}

export async function sil(id: string): Promise<boolean> {
  const silinen = await db.delete(malKabuller).where(eq(malKabuller.id, id)).returning({ id: malKabuller.id });
  return silinen.length > 0;
}
