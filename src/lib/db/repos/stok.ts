import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  DEVIR_PENCERESI_GUN,
  devirHizi,
  kalanAdet,
  stokDurumu,
  tukenmeGun,
  type StokDurumu,
} from "@/lib/depo/stok-hesap";

/**
 * STOK RAPORU — barkod bazında giren / çıkan / kalan.
 *
 * GİREN: `mal_kabul_kalemleri.adet` toplamı (işaretli; iade ve düzeltme dâhil).
 * ÇIKAN: okutulan paketlerin sipariş kalemleri. Paket → sipariş eşlemesi
 * okutma ekranıyla AYNI kural (`okut-siparis.takipNoIleSiparis`): takip no
 * önce, sonra sipariş no, tek sipariş. Kalemler `ham_veri._normal.kalemler`
 * (yeni satırlar) ya da Trendyol `lines` (eski satırlar) üzerinden okunur —
 * ham-veri.ts ile aynı öncelik. Sipariş eşleşmeyen paket (Excel/elle
 * barkod) stoğu düşürmez; bu bilinçli: kalemi bilmediğimiz paketi tahminle
 * düşmek raporu bozar, depo o ürünleri sayımla düzeltir.
 *
 * Ürünler kataloğa join'lenir ki ad/görsel gelsin; katalogda olmayan barkod
 * da listelenir (kabul edildi ama ürün kartı yok → uyarı).
 */

export interface StokSatiri {
  barkod: string;
  urunAdi: string | null;
  gorselUrl: string | null;
  giren: number;
  cikan: number;
  kalan: number;
  son30Cikis: number;
  tukenmeGun: number | null;
  devirHizi: number | null;
  durum: StokDurumu;
  katalogda: boolean;
}

export interface StokOzeti {
  cesit: number;
  toplamKalan: number;
  kritik: number;
  eksi: number;
  hareketsiz: number;
}

export const SAYFA_LIMITI = 50;

/** Ortak CTE: şirketin barkod bazında giren/çıkan sayıları. */
function stokCte(sirketId: string) {
  return sql`
    with giren as (
      select barkod, sum(adet)::int as giren
      from mal_kabul_kalemleri
      where sirket_id = ${sirketId}::uuid
      group by barkod
    ),
    okutulan as (
      select p.barkod as paket_barkodu, p.okutma_zamani, s.ham_veri
      from paket_okutmalari p
      join lateral (
        select ham_veri
        from pazaryeri_siparisleri s
        where s.sirket_id = p.sirket_id
          and (s.kargo_takip_no = p.barkod or s.siparis_no = p.barkod)
        order by case when s.kargo_takip_no = p.barkod then 0 else 1 end
        limit 1
      ) s on true
      where p.sirket_id = ${sirketId}::uuid
    ),
    cikan as (
      select
        k.barkod,
        sum(k.adet)::int as cikan,
        sum(k.adet) filter (where o.okutma_zamani > now() - (${DEVIR_PENCERESI_GUN}::int * interval '1 day'))::int as son30
      from okutulan o
      cross join lateral (
        select
          coalesce(nullif(x->>'barkod',''), nullif(x->>'barcode',''), nullif(x->>'productCode','')) as barkod,
          greatest(coalesce(nullif(x->>'adet','')::int, nullif(x->>'quantity','')::int, 1), 1) as adet
        from jsonb_array_elements(
          coalesce(o.ham_veri->'_normal'->'kalemler', o.ham_veri->'lines', '[]'::jsonb)
        ) x
      ) k
      where k.barkod is not null
      group by k.barkod
    ),
    stok as (
      select
        coalesce(g.barkod, c.barkod) as barkod,
        coalesce(g.giren, 0) as giren,
        coalesce(c.cikan, 0) as cikan,
        coalesce(c.son30, 0) as son30
      from giren g
      full outer join cikan c on c.barkod = g.barkod
    )`;
}

/** `db.execute` `Record<string, unknown>` ister; tip takma adı (arayüz değil) örtük indeks imzası taşır. */
type HamSatir = {
  barkod: string;
  urun_adi: string | null;
  gorsel_url: string | null;
  giren: number;
  cikan: number;
  son30: number;
  katalogda: boolean;
};

function satiraCevir(h: HamSatir): StokSatiri {
  const s = { giren: h.giren, cikan: h.cikan, son30Cikis: h.son30 };
  return {
    barkod: h.barkod,
    urunAdi: h.urun_adi,
    gorselUrl: h.gorsel_url,
    giren: h.giren,
    cikan: h.cikan,
    kalan: kalanAdet(s),
    son30Cikis: h.son30,
    tukenmeGun: tukenmeGun(s),
    devirHizi: devirHizi(s),
    durum: stokDurumu(s),
    katalogda: h.katalogda,
  };
}

export async function stokRaporu(
  sirketId: string,
  { arama = "", sayfa = 0, limit = SAYFA_LIMITI }: { arama?: string; sayfa?: number; limit?: number } = {},
): Promise<{ satirlar: StokSatiri[]; toplam: number }> {
  const desen = `%${arama.trim()}%`;
  const aramaKosulu = arama.trim()
    ? sql`and (st.barkod ilike ${desen} or u.urun_adi ilike ${desen} or u.stok_kodu ilike ${desen})`
    : sql``;

  const satirlar = await db.execute<HamSatir>(sql`
    ${stokCte(sirketId)}
    select st.barkod, u.urun_adi, u.gorsel_url, st.giren, st.cikan, st.son30,
           (u.id is not null) as katalogda
    from stok st
    left join urunler u on u.sirket_id = ${sirketId}::uuid and u.barkod = st.barkod
    where true ${aramaKosulu}
    order by (st.giren - st.cikan) asc, st.son30 desc, st.barkod
    limit ${limit} offset ${sayfa * limit}
  `);
  const [sayim] = await db.execute<{ toplam: number }>(sql`
    ${stokCte(sirketId)}
    select count(*)::int as toplam
    from stok st
    left join urunler u on u.sirket_id = ${sirketId}::uuid and u.barkod = st.barkod
    where true ${aramaKosulu}
  `);
  return { satirlar: satirlar.map(satiraCevir), toplam: sayim?.toplam ?? 0 };
}

/** Kartlar için özet; durum sınıflaması uygulamada (formül tek yerde). */
export async function stokOzeti(sirketId: string): Promise<StokOzeti> {
  const satirlar = await db.execute<{ barkod: string; giren: number; cikan: number; son30: number }>(sql`
    ${stokCte(sirketId)}
    select barkod, giren, cikan, son30 from stok
  `);
  const ozet: StokOzeti = { cesit: 0, toplamKalan: 0, kritik: 0, eksi: 0, hareketsiz: 0 };
  for (const h of satirlar) {
    const s = { giren: h.giren, cikan: h.cikan, son30Cikis: h.son30 };
    ozet.cesit++;
    ozet.toplamKalan += Math.max(0, kalanAdet(s));
    const d = stokDurumu(s);
    if (d === "kritik") ozet.kritik++;
    else if (d === "eksi") ozet.eksi++;
    else if (d === "hareketsiz") ozet.hareketsiz++;
  }
  return ozet;
}
