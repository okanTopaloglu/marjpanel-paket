import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pazaryeriSiparisleri, sirketler, urunler } from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";
import { NIHAI_DURUMLAR } from "@/lib/siparis/sabitler";
import { gorunenDurum, type GorunenDurum, type Sekme } from "@/lib/siparis/durum";
import { sekmeKosulu } from "@/lib/siparis/sekme-sql";
import {
  asgariHamVeri,
  aliciTelefonu,
  etiketAdresi,
  musteriAdi,
  siparisKalemleri,
  type AsgariHamVeri,
  type AsgariKalem,
} from "@/lib/siparis/ham-veri";
import type { EslenenSiparis } from "@/lib/trendyol/esle";

/**
 * PAZARYERİ SİPARİŞ REPOSU.
 *
 * İKİ KURAL BU DOSYANIN TAMAMINDA GEÇERLİDİR:
 *
 *  1. HAM VERİ İSTEMCİYE İNMEZ. `ham_veri` Trendyol yükünün TAMAMIDIR (TC
 *     kimlik, fatura adresi, satır bazlı fiyat/komisyon). Liste ve detay
 *     satırları her zaman `lib/siparis/ham-veri` süzgeçlerinden geçer;
 *     `hamVeri` alanı hiçbir dönüş tipinde yoktur.
 *  2. KAPSAM AÇIK PARAMETREDİR. Her sorgu `sirket_id` ile sınırlanır; şirket
 *     kimliği istemciden gelen hiçbir değerden okunmaz (bkz. lib/auth/kapsam).
 */

/** Tek turda yazılan satır sayısı (PartnerSys ile aynı). */
export const YIGIN_BOYUTU = 50;

/** SQL `in ('Shipped', ...)` listesi - değerler beyaz listeden gelir. */
const NIHAI_LISTE = sql.raw(NIHAI_DURUMLAR.map((d) => `'${d}'`).join(", "));

/* ------------------------------------------------------------------ */
/* Yazma                                                               */
/* ------------------------------------------------------------------ */

/**
 * Senkron yazma yolu: 50'lik yığınlarla `INSERT ... ON CONFLICT DO UPDATE`.
 *
 * NİHAİ DURUM KORUNUR (`where ... durum not in (...)`): PartnerSys aynı işi
 * her yığın için ÖNCE bir `SELECT` atıp nihai satırları elemekle yapıyordu -
 * yığın başına fazladan gidiş dönüş. Aynı güvence Postgres'in `DO UPDATE ...
 * WHERE` cümlesiyle tek sorguda alınır: kargoya verilmiş/iptal olmuş satır
 * Trendyol geç bir yankı yollasa bile geri diriltilmez.
 *
 * `kargo_zamani` YALNIZ İLK KEZ yazılır (sonraki senkron kargoya veriliş
 * anını bugüne kaydırmasın), `kargo_firmasi` boş gelirse ESKİSİ korunur
 * (Trendyol kargo adını bazı sayfalarda boş yollar).
 */
export async function topluUpsert(
  sirketId: string,
  satirlar: EslenenSiparis[],
): Promise<number> {
  if (satirlar.length === 0) return 0;

  /*
   * Tarih ISO METİN + `::timestamptz` olarak geçilir: ham `Date` nesnesi,
   * sütun tipi bilinmeyen bir `sql` parçasında postgres.js'e doğrudan iner ve
   * sürücü onu seri hâle getiremez ("string argument expected, received Date").
   */
  let yazilan = 0;
  for (let i = 0; i < satirlar.length; i += YIGIN_BOYUTU) {
    const yigin = satirlar.slice(i, i + YIGIN_BOYUTU);
    const degerler = yigin.map(
      (s) => sql`(
        ${sirketId}::uuid,
        ${s.platform},
        ${s.siparisKimligi},
        ${s.siparisNo},
        ${s.kargoTakipNo},
        ${s.durum},
        ${s.siparisTarihi ? s.siparisTarihi.toISOString() : null}::timestamptz,
        ${JSON.stringify(s.hamVeri ?? {})}::jsonb,
        ${s.icerikImzasi},
        ${s.entegrasyonAdi},
        ${s.kargoFirmasi}
      )`,
    );

    const sonuc = await db.execute<{ id: string }>(sql`
      insert into pazaryeri_siparisleri (
        sirket_id, platform, siparis_kimligi, siparis_no, kargo_takip_no,
        durum, siparis_tarihi, ham_veri, icerik_imzasi, entegrasyon_adi,
        kargo_firmasi
      )
      values ${sql.join(degerler, sql`, `)}
      on conflict (sirket_id, platform, siparis_kimligi) do update set
        siparis_no     = excluded.siparis_no,
        kargo_takip_no = excluded.kargo_takip_no,
        durum          = excluded.durum,
        siparis_tarihi = excluded.siparis_tarihi,
        ham_veri       = excluded.ham_veri,
        icerik_imzasi  = excluded.icerik_imzasi,
        entegrasyon_adi = excluded.entegrasyon_adi,
        kargo_firmasi  = coalesce(excluded.kargo_firmasi, pazaryeri_siparisleri.kargo_firmasi),
        kargo_zamani   = case
                           when excluded.durum in ('Shipped', 'Delivered')
                            and pazaryeri_siparisleri.kargo_zamani is null
                           then now()
                           else pazaryeri_siparisleri.kargo_zamani
                         end,
        son_guncelleme = now()
      where pazaryeri_siparisleri.durum not in (${NIHAI_LISTE})
      returning id
    `);
    yazilan += sonuc.length;
  }
  return yazilan;
}

/* ------------------------------------------------------------------ */
/* Okuma                                                               */
/* ------------------------------------------------------------------ */

export interface SiparisSatiri {
  id: string;
  platform: string;
  siparisKimligi: string;
  siparisNo: string | null;
  kargoTakipNo: string | null;
  /** Pazaryerinin ham durumu (rozet metni değil). */
  durum: string;
  gorunenDurum: GorunenDurum;
  siparisTarihi: Date | null;
  kargoFirmasi: string | null;
  entegrasyonAdi: string | null;
  hazirZamani: Date | null;
  yazdirmaZamani: Date | null;
  /** Ham yükün istemciye inen alt kümesi (müşteri, adres özeti, kalemler). */
  asgari: AsgariHamVeri;
}

export interface SayfaFiltresi {
  sekme: Sekme;
  platform?: string;
  arama?: string;
  kargo?: string;
  entegrasyon?: string;
  /** 0 tabanlı. */
  sayfa?: number;
  limit?: number;
}

export interface SayfaSonucu {
  satirlar: SiparisSatiri[];
  toplam: number;
  sayfa: number;
  limit: number;
  sayfaSayisi: number;
}

export const VARSAYILAN_LIMIT = 50;
const AZAMI_LIMIT = 200;

/** Ortak filtre zinciri; sayım ve sayfa sorgusu AYNI koşulları kullanır. */
function kosullar(sirketId: string, f: SayfaFiltresi): SQL[] {
  const liste: SQL[] = [
    eq(pazaryeriSiparisleri.sirketId, sirketId),
    sql`(${sql.raw(sekmeKosulu(f.sekme))})`,
  ];

  const platform = f.platform?.trim();
  if (platform) liste.push(eq(pazaryeriSiparisleri.platform, platform));

  const entegrasyon = f.entegrasyon?.trim();
  if (entegrasyon) liste.push(eq(pazaryeriSiparisleri.entegrasyonAdi, entegrasyon));

  const kargo = f.kargo?.trim();
  if (kargo) liste.push(eq(pazaryeriSiparisleri.kargoFirmasi, kargo));

  const arama = f.arama?.trim();
  if (arama) {
    // Sipariş no ve takip no: kullanıcı ikisini de aynı kutuya yapıştırır.
    // `%` ve `_` kaçırılır, aksi halde tek bir `%` tüm tabloyu tarardı.
    const desen = `%${arama.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    liste.push(
      sql`(${pazaryeriSiparisleri.siparisNo} ilike ${desen} escape '\\'
        or ${pazaryeriSiparisleri.kargoTakipNo} ilike ${desen} escape '\\')`,
    );
  }

  return liste;
}

function satira(s: {
  id: string;
  platform: string;
  siparisKimligi: string;
  siparisNo: string | null;
  kargoTakipNo: string | null;
  durum: string;
  siparisTarihi: Date | null;
  kargoFirmasi: string | null;
  entegrasyonAdi: string | null;
  hazirZamani: Date | null;
  yazdirmaZamani: Date | null;
  hamVeri: unknown;
}): SiparisSatiri {
  return {
    id: s.id,
    platform: s.platform,
    siparisKimligi: s.siparisKimligi,
    siparisNo: s.siparisNo,
    kargoTakipNo: s.kargoTakipNo,
    durum: s.durum,
    gorunenDurum: gorunenDurum(s.durum, s.hazirZamani, s.kargoTakipNo),
    siparisTarihi: s.siparisTarihi,
    kargoFirmasi: s.kargoFirmasi,
    entegrasyonAdi: s.entegrasyonAdi,
    hazirZamani: s.hazirZamani,
    yazdirmaZamani: s.yazdirmaZamani,
    asgari: asgariHamVeri(s.hamVeri),
  };
}

/** Liste sayfası. Sıralama: en yeni sipariş üstte (tarihi boş olanlar sonda). */
export async function sayfa(k: Kapsam, f: SayfaFiltresi): Promise<SayfaSonucu> {
  const limit = Math.min(AZAMI_LIMIT, Math.max(1, Math.round(f.limit ?? VARSAYILAN_LIMIT)));
  const sayfaNo = Math.max(0, Math.round(f.sayfa ?? 0));
  const nerede = and(...kosullar(k.sirketId, f));

  const [sayim] = await db
    .select({ adet: sql<number>`count(*)::int` })
    .from(pazaryeriSiparisleri)
    .where(nerede);
  const toplam = sayim?.adet ?? 0;
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / limit));
  // Filtre daralınca istemcideki sayfa numarası aralık dışında kalabilir;
  // boş ekran göstermek yerine son sayfaya oturulur.
  const etkinSayfa = Math.min(sayfaNo, sayfaSayisi - 1);

  const satirlar = await db
    .select({
      id: pazaryeriSiparisleri.id,
      platform: pazaryeriSiparisleri.platform,
      siparisKimligi: pazaryeriSiparisleri.siparisKimligi,
      siparisNo: pazaryeriSiparisleri.siparisNo,
      kargoTakipNo: pazaryeriSiparisleri.kargoTakipNo,
      durum: pazaryeriSiparisleri.durum,
      siparisTarihi: pazaryeriSiparisleri.siparisTarihi,
      kargoFirmasi: pazaryeriSiparisleri.kargoFirmasi,
      entegrasyonAdi: pazaryeriSiparisleri.entegrasyonAdi,
      hazirZamani: pazaryeriSiparisleri.hazirZamani,
      yazdirmaZamani: pazaryeriSiparisleri.yazdirmaZamani,
      hamVeri: pazaryeriSiparisleri.hamVeri,
    })
    .from(pazaryeriSiparisleri)
    .where(nerede)
    .orderBy(
      sql`${pazaryeriSiparisleri.siparisTarihi} desc nulls last`,
      desc(pazaryeriSiparisleri.sonGuncelleme),
    )
    .limit(limit)
    .offset(etkinSayfa * limit);

  return {
    satirlar: satirlar.map(satira),
    toplam,
    sayfa: etkinSayfa,
    limit,
    sayfaSayisi,
  };
}

export type SekmeSayilari = Record<Sekme, number>;

/**
 * Sekme rozetlerindeki sayılar. TEK sorguda `count(*) filter (where ...)`:
 * yedi ayrı sorgu atmak liste ekranını her yenilemede yedi kez tablo
 * taratırdı. Sayılar sekmenin KENDİ koşulunu kullanır; arama/kargo gibi
 * ikincil filtreler BİLEREK uygulanmaz - rozet "bu kutuda toplam kaç iş var"
 * sorusunu cevaplar, "aramamda kaç tane var" sorusunu değil.
 */
export async function sekmeSayilari(k: Kapsam): Promise<SekmeSayilari> {
  const say = (s: Sekme) =>
    sql<number>`count(*) filter (where ${sql.raw(sekmeKosulu(s))})::int`;

  const [satir] = await db
    .select({
      tumu: sql<number>`count(*)::int`,
      bekleyen: say("bekleyen"),
      bekleyen_kargo: say("bekleyen_kargo"),
      hazir: say("hazir"),
      kargoda: say("kargoda"),
      iptal: say("iptal"),
      sevk_gecikmis: say("sevk_gecikmis"),
    })
    .from(pazaryeriSiparisleri)
    .where(eq(pazaryeriSiparisleri.sirketId, k.sirketId));

  return {
    tumu: satir?.tumu ?? 0,
    bekleyen: satir?.bekleyen ?? 0,
    bekleyen_kargo: satir?.bekleyen_kargo ?? 0,
    hazir: satir?.hazir ?? 0,
    kargoda: satir?.kargoda ?? 0,
    iptal: satir?.iptal ?? 0,
    sevk_gecikmis: satir?.sevk_gecikmis ?? 0,
  };
}

/** Filtre açılırındaki kargo firmaları (yalnız veride GEÇEN adlar). */
export async function kargoAdlari(k: Kapsam): Promise<string[]> {
  const satirlar = await db
    .selectDistinct({ ad: pazaryeriSiparisleri.kargoFirmasi })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        sql`${pazaryeriSiparisleri.kargoFirmasi} is not null and ${pazaryeriSiparisleri.kargoFirmasi} <> ''`,
      ),
    )
    .orderBy(pazaryeriSiparisleri.kargoFirmasi);
  return satirlar.map((s) => s.ad).filter((a): a is string => !!a);
}

/** Filtre açılırındaki mağaza (entegrasyon) adları. */
export async function entegrasyonAdlari(k: Kapsam): Promise<string[]> {
  const satirlar = await db
    .selectDistinct({ ad: pazaryeriSiparisleri.entegrasyonAdi })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        sql`${pazaryeriSiparisleri.entegrasyonAdi} is not null and ${pazaryeriSiparisleri.entegrasyonAdi} <> ''`,
      ),
    )
    .orderBy(pazaryeriSiparisleri.entegrasyonAdi);
  return satirlar.map((s) => s.ad).filter((a): a is string => !!a);
}

export interface DetayKalemi extends AsgariKalem {
  /** Ürün kataloğundaki görsel; barkod eşleşmezse null. */
  gorselUrl: string | null;
}

export interface SiparisDetayi extends SiparisSatiri {
  musteriAd: string;
  telefon: string;
  adresAcik: string;
  adresIlceIl: string;
  kalemler: DetayKalemi[];
}

/**
 * Tek siparişin detayı: kalemler ÜRÜN GÖRSELLERİYLE zenginleştirilir.
 *
 * Görseller `urunler` tablosundan TEK sorguda okunur (barkod listesiyle).
 * Ürün reposu M2 ajanının sahibi olduğu dosya; buradan yalnız SALT OKUNUR
 * bir select yapılır, o dosyaya dokunulmaz.
 */
export async function detay(k: Kapsam, id: string): Promise<SiparisDetayi | null> {
  const [s] = await db
    .select()
    .from(pazaryeriSiparisleri)
    .where(
      and(eq(pazaryeriSiparisleri.id, id), eq(pazaryeriSiparisleri.sirketId, k.sirketId)),
    )
    .limit(1);
  if (!s) return null;

  const kalemler = siparisKalemleri(s.hamVeri);
  const barkodlar = [...new Set(kalemler.map((x) => x.barkod).filter(Boolean))];

  const gorseller = new Map<string, string | null>();
  if (barkodlar.length) {
    const urunSatirlari = await db
      .select({ barkod: urunler.barkod, gorselUrl: urunler.gorselUrl })
      .from(urunler)
      .where(and(eq(urunler.sirketId, k.sirketId), inArray(urunler.barkod, barkodlar)));
    for (const u of urunSatirlari) gorseller.set(u.barkod, u.gorselUrl);
  }

  const adres = etiketAdresi(s.hamVeri);
  return {
    ...satira(s),
    musteriAd: musteriAdi(s.hamVeri),
    telefon: aliciTelefonu(s.hamVeri),
    adresAcik: adres.acik,
    adresIlceIl: adres.ilceIl,
    kalemler: kalemler.map((x) => ({ ...x, gorselUrl: gorseller.get(x.barkod) ?? null })),
  };
}

/* ------------------------------------------------------------------ */
/* Eylemler                                                            */
/* ------------------------------------------------------------------ */

/** Etiket basıldıktan sonra işaretler; listedeki "Yazdırıldı" sütunu bunu okur. */
export async function yazdirildiIsaretle(k: Kapsam, ids: string[]): Promise<number> {
  const tekil = [...new Set(ids.filter(Boolean))];
  if (tekil.length === 0) return 0;
  const satirlar = await db
    .update(pazaryeriSiparisleri)
    .set({ yazdirmaZamani: new Date(), sonGuncelleme: new Date() })
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        inArray(pazaryeriSiparisleri.id, tekil),
      ),
    )
    .returning({ id: pazaryeriSiparisleri.id });
  return satirlar.length;
}

/** `eskileriSil` için alt sınır: PartnerSys'teki 7 günlük eşik korunur. */
export const ASGARI_SILME_GUNU = 7;

/**
 * Eski siparişleri siler (tablo sonsuza kadar büyümesin).
 *
 * PartnerSys `deleteOlderThan` yalnız `orderDate < cutoff` bakıyordu. BURADA
 * BİR KORUMA EKLENDİ: HAZIRLANMAMIŞ ve henüz NİHAİ DURUMA GELMEMİŞ satırlar
 * (hazir_zamani IS NULL ve durum nihai değil) tarihleri ne olursa olsun
 * SİLİNMEZ. Gerekçe: bu satırlar hâlâ toplama havuzundadır; depoda okutulmayı
 * bekleyen bir paketi temizlik işi silince okutma ekranında "sipariş yok"
 * hatası çıkıyor, paket kaybolmuş gibi görünüyordu. Kargoya verilmiş, teslim
 * edilmiş, iptal ya da iade olmuş satırlar (nihai durumlar) ile hazırlanmış
 * satırlar normal şekilde silinir.
 */
export async function eskileriSil(k: Kapsam, gun: number): Promise<number> {
  const g = Math.max(ASGARI_SILME_GUNU, Math.round(gun));
  const satirlar = await db
    .delete(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        sql`${pazaryeriSiparisleri.siparisTarihi} is not null`,
        sql`${pazaryeriSiparisleri.siparisTarihi} < now() - ${sql.raw(`interval '${g} days'`)}`,
        sql`(${pazaryeriSiparisleri.hazirZamani} is not null
             or ${pazaryeriSiparisleri.durum} in (${NIHAI_LISTE}))`,
      ),
    )
    .returning({ id: pazaryeriSiparisleri.id });
  return satirlar.length;
}

/* ------------------------------------------------------------------ */
/* Etiket                                                              */
/* ------------------------------------------------------------------ */

export interface EtiketKarti {
  id: string;
  siparisNo: string | null;
  kargoTakipNo: string | null;
  kargoFirmasi: string | null;
  siparisTarihi: Date | null;
  musteriAd: string;
  telefon: string;
  adresAcik: string;
  adresIlceIl: string;
  kalemler: AsgariKalem[];
  /** Gönderici satırı: şirket adı (etiketin alt bilgisi). */
  gonderici: string;
}

/**
 * Yazdırılacak etiket kartları. Sıralama VERİLEN ID SIRASI DEĞİL, sipariş
 * tarihine göredir (en eski önce): depo etiketleri basıldıkları sırayla
 * toplar, en eski sipariş ilk çıkmalıdır.
 */
export async function etiketKartlari(k: Kapsam, ids: string[]): Promise<EtiketKarti[]> {
  const tekil = [...new Set(ids.filter(Boolean))];
  if (tekil.length === 0) return [];

  const [sirket] = await db
    .select({ ad: sirketler.ad })
    .from(sirketler)
    .where(eq(sirketler.id, k.sirketId))
    .limit(1);
  const gonderici = sirket?.ad ?? k.sirket.ad;

  const satirlar = await db
    .select()
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, k.sirketId),
        inArray(pazaryeriSiparisleri.id, tekil),
      ),
    )
    .orderBy(sql`${pazaryeriSiparisleri.siparisTarihi} asc nulls last`);

  return satirlar.map((s) => {
    const adres = etiketAdresi(s.hamVeri);
    return {
      id: s.id,
      siparisNo: s.siparisNo,
      kargoTakipNo: s.kargoTakipNo,
      kargoFirmasi: s.kargoFirmasi,
      siparisTarihi: s.siparisTarihi,
      musteriAd: musteriAdi(s.hamVeri),
      telefon: aliciTelefonu(s.hamVeri),
      adresAcik: adres.acik,
      adresIlceIl: adres.ilceIl,
      kalemler: siparisKalemleri(s.hamVeri),
      gonderici,
    };
  });
}
