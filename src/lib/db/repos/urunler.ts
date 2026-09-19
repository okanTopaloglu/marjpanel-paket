import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { urunler } from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";

/**
 * ÜRÜN REPOSU.
 *
 * İki yüzeyi var. Birincisi okutma/toplama akışının sıcak yolu: sipariş
 * satırlarının barkodlarını ürün adı ve görseliyle zenginleştirmek
 * (`barkodlarlaGetir`, `sirketId`'yi düz parametre alır). İkincisi ürün
 * yönetimi ekranı: liste, upsert, toplu içe aktarma, silme - bunlar `Kapsam`
 * alır ve kiracıyı ORADAN okur.
 */

export interface UrunOzeti {
  urunAdi: string | null;
  gorselUrl: string | null;
}

/**
 * Barkod → ürün özeti haritası. TEK sorgu: sipariş satırları tek tek
 * sorgulansaydı 20 kalemlik bir toplama listesi 20 gidiş dönüş ederdi.
 * Bulunamayan barkod haritada YOKTUR (çağıran `?? null` ile kendi
 * varsayılanını verir).
 */
export async function barkodlarlaGetir(
  sirketId: string,
  barkodlar: string[],
): Promise<Map<string, UrunOzeti>> {
  const tekil = [...new Set(barkodlar.filter(Boolean))];
  const harita = new Map<string, UrunOzeti>();
  if (tekil.length === 0) return harita;

  const satirlar = await db
    .select({
      barkod: urunler.barkod,
      urunAdi: urunler.urunAdi,
      gorselUrl: urunler.gorselUrl,
    })
    .from(urunler)
    .where(and(eq(urunler.sirketId, sirketId), inArray(urunler.barkod, tekil)));

  for (const s of satirlar) {
    harita.set(s.barkod, { urunAdi: s.urunAdi, gorselUrl: s.gorselUrl });
  }
  return harita;
}

/* ------------------------------------------------------------------ */
/* M4 - ürün yönetimi (liste, upsert, toplu içe aktarma, silme)        */
/* ------------------------------------------------------------------ */

/**
 * YAZMA KURALI: YALNIZ DOLU ALAN YAZILIR.
 *
 * Elle düzenleme ve Excel içe aktarma, Trendyol senkronunun doldurduğu
 * kataloğun ÜZERİNE yazar. Kullanıcının Excel'inde görsel sütunu yoksa düz
 * bir `excluded.gorsel_url` ataması senkronla gelen bütün görselleri
 * silerdi - okutma ekranı bir anda resimsiz kalırdı. Bu yüzden her sütun
 * `coalesce(nullif(excluded.x, ''), urunler.x)` ile yazılır: boş gelen alan
 * var olanı korur (`lib/senkron/urun-senkron.ts` ile AYNI kural).
 *
 * `son_senkron` bu yolla GÜNCELLENMEZ: o sütun "pazaryerinden en son ne
 * zaman tazelendi" sorusunun cevabıdır; elle girilen bir satır onu taze
 * göstermemelidir.
 */

/** Listede bir satır. */
export interface UrunSatiri {
  id: string;
  barkod: string;
  urunAdi: string | null;
  gorselUrl: string | null;
  marka: string | null;
  kategori: string | null;
  stokKodu: string | null;
  sonSenkron: Date | null;
  updatedAt: Date;
}

export interface SayfaSecenekleri {
  /** Barkod, ürün adı ya da stok kodunda geçen metin. */
  arama?: string;
  /** 0 tabanlı sayfa. */
  sayfa?: number;
  limit?: number;
}

export const SAYFA_LIMITI = 50;
const AZAMI_LIMIT = 200;

/** Arama koşulu (boşsa yalnız şirket filtresi). */
function aramaKosulu(sirketId: string, arama?: string) {
  const metin = (arama ?? "").trim();
  if (!metin) return eq(urunler.sirketId, sirketId);
  const kalip = `%${metin}%`;
  return and(
    eq(urunler.sirketId, sirketId),
    or(
      ilike(urunler.barkod, kalip),
      ilike(urunler.urunAdi, kalip),
      ilike(urunler.stokKodu, kalip),
    ),
  );
}

/**
 * Ürün sayfası. Sıralama `updated_at desc`: en son dokunulan (senkronla
 * tazelenen ya da elle düzenlenen) ürün başta durur - kullanıcı bir kayıt
 * düzenledikten sonra onu aramak zorunda kalmaz.
 */
export async function sayfa(
  k: Kapsam,
  secenekler: SayfaSecenekleri = {},
): Promise<UrunSatiri[]> {
  const limit = Math.min(
    AZAMI_LIMIT,
    Math.max(1, Math.round(secenekler.limit ?? SAYFA_LIMITI)),
  );
  const sayfaNo = Math.max(0, Math.round(secenekler.sayfa ?? 0));

  return db
    .select({
      id: urunler.id,
      barkod: urunler.barkod,
      urunAdi: urunler.urunAdi,
      gorselUrl: urunler.gorselUrl,
      marka: urunler.marka,
      kategori: urunler.kategori,
      stokKodu: urunler.stokKodu,
      sonSenkron: urunler.sonSenkron,
      updatedAt: urunler.updatedAt,
    })
    .from(urunler)
    .where(aramaKosulu(k.sirketId, secenekler.arama))
    .orderBy(desc(urunler.updatedAt))
    .limit(limit)
    .offset(sayfaNo * limit);
}

/** Toplam kayıt (arama verilirse aramaya uyan kayıt) sayısı. */
export async function sayim(k: Kapsam, arama?: string): Promise<number> {
  const [satir] = await db
    .select({ adet: count() })
    .from(urunler)
    .where(aramaKosulu(k.sirketId, arama));
  return satir?.adet ?? 0;
}

/** Kaydedilebilir ürün alanları. Barkod dışındakiler boş bırakılabilir. */
export interface UrunGirdisi {
  barkod: string;
  urunAdi?: string | null;
  gorselUrl?: string | null;
  marka?: string | null;
  kategori?: string | null;
  stokKodu?: string | null;
}

/** Kırpılmış metin. */
function metin(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/**
 * Boş değeri NULL'a çevirir.
 *
 * NEDEN "" DEĞİL NULL: güncellemede `nullif(excluded.x, '')` boşu zaten yok
 * sayar, ama İLK EKLEMEDE boş metin olduğu gibi yazılırdı. O satır
 * `urun_adi = ''` olurdu ve `urunAdi ?? "-"` yazan her ekran (liste, okutma
 * kalemi) boş hücre gösterirdi - "adı yok" ile "adı boş metin" aynı şey
 * değil, ikincisi arayüzde yalnız kafa karıştırır.
 */
function bosNull(v: string | null | undefined): string | null {
  return metin(v) || null;
}

/** Tek satırı `(sirket_id, barkod)` üzerinde upsert eder. */
export async function kaydet(k: Kapsam, girdi: UrunGirdisi): Promise<number> {
  const barkod = metin(girdi.barkod);
  if (!barkod) return 0;
  return topluKaydet(k, [{ ...girdi, barkod }]);
}

/** Tek INSERT'te yazılan satır sayısı. Excel dosyaları on binlerce satır olabilir. */
export const YIGIN_BOYUTU = 200;

/**
 * Toplu upsert. Satırlar 200'lük yığınlara bölünür: tek ifadeye 20.000 satır
 * koymak sorgu metnini megabaytlara çıkarır ve Postgres'in parametre sınırına
 * dayanır. Dönüş: yazılan (eklenen ya da güncellenen) satır sayısı.
 */
export async function topluKaydet(
  k: Kapsam,
  satirlar: UrunGirdisi[],
): Promise<number> {
  const temiz = satirlar
    .map((s) => ({
      barkod: metin(s.barkod),
      urunAdi: bosNull(s.urunAdi),
      gorselUrl: bosNull(s.gorselUrl),
      marka: bosNull(s.marka),
      kategori: bosNull(s.kategori),
      stokKodu: bosNull(s.stokKodu),
    }))
    .filter((s) => s.barkod.length > 0);
  if (temiz.length === 0) return 0;

  /*
   * AYNI DOSYADA MÜKERRER BARKOD: tek INSERT içinde aynı çakışma anahtarına
   * iki kez dokunmak Postgres'te "ON CONFLICT DO UPDATE command cannot affect
   * row a second time" hatası verir ve BÜTÜN yığın düşerdi. Son satır kazanır
   * (kullanıcının dosyada en altta yazdığı değer en günceli sayılır).
   */
  const tekil = new Map<string, (typeof temiz)[number]>();
  for (const s of temiz) tekil.set(s.barkod, s);
  const liste = [...tekil.values()];

  let yazilan = 0;
  for (let i = 0; i < liste.length; i += YIGIN_BOYUTU) {
    const yigin = liste.slice(i, i + YIGIN_BOYUTU);
    const degerler = yigin.map(
      (u) => sql`(
        ${k.sirketId}::uuid,
        ${u.barkod},
        ${u.urunAdi},
        ${u.gorselUrl},
        ${u.marka},
        ${u.kategori},
        ${u.stokKodu}
      )`,
    );

    const sonuc = await db.execute<{ id: string }>(sql`
      insert into urunler (
        sirket_id, barkod, urun_adi, gorsel_url, marka, kategori, stok_kodu
      )
      values ${sql.join(degerler, sql`, `)}
      on conflict (sirket_id, barkod) do update set
        urun_adi   = coalesce(nullif(excluded.urun_adi, ''), urunler.urun_adi),
        gorsel_url = coalesce(nullif(excluded.gorsel_url, ''), urunler.gorsel_url),
        marka      = coalesce(nullif(excluded.marka, ''), urunler.marka),
        kategori   = coalesce(nullif(excluded.kategori, ''), urunler.kategori),
        stok_kodu  = coalesce(nullif(excluded.stok_kodu, ''), urunler.stok_kodu),
        updated_at = now()
      returning id
    `);
    yazilan += sonuc.length;
  }
  return yazilan;
}

/** Ürünü siler. Kiracı filtresi sorguda: id tek başına yetmez. */
export async function sil(k: Kapsam, id: string): Promise<number> {
  const kimlik = (id ?? "").trim();
  if (!kimlik) return 0;
  const satirlar = await db
    .delete(urunler)
    .where(and(eq(urunler.sirketId, k.sirketId), eq(urunler.id, kimlik)))
    .returning({ id: urunler.id });
  return satirlar.length;
}
