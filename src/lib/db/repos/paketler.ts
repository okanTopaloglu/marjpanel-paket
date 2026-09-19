import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { kaynaktanPlatform } from "@/lib/pazaryeri/kayit";
import { db } from "@/lib/db/client";
import { kullanicilar, paketOkutmalari } from "@/lib/db/schema";
import { adminMi, type Kapsam } from "@/lib/auth/kapsam";
import type { BarkodBilgisi } from "@/lib/barkod/coz";
import { okutmaEngeli } from "@/lib/siparis/durum";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";
import { gunAnahtari } from "@/lib/format/tarih";
import type { OkutmaSonucu, OkutmaUyarisi } from "@/lib/okut/sonuc";
import type { PaketFiltreleri } from "@/lib/paket/filtreler";
import { barkodCoz } from "@/lib/db/repos/barkod-kurallari";
import {
  aktifEntegrasyonVarMi,
  hazirIsaretle,
  takipNoIleSiparis,
  type Islem,
} from "@/lib/db/repos/okut-siparis";

/**
 * PAKET OKUTMA REPOSU - uygulamanın kalbi.
 *
 * Kiracı izolasyonu: her fonksiyon `Kapsam` alır ve `sirketId`'yi ORADAN
 * okur. İstemciden gelen hiçbir şirket kimliği bu dosyaya girmez.
 *
 * Rol kuralı: `calisan` YALNIZ kendi okutmalarını görür. Bu kısıt sunucuda,
 * sorgunun kendisinde uygulanır - arayüzdeki gizleme yalnız süstür.
 */

/** İstanbul takvim günü ifadesi - gün bazlı filtre ve "bugün" hesabı. */
const ISTANBUL_GUN = sql`(${paketOkutmalari.okutmaZamani} AT TIME ZONE ${ISTANBUL_TZ})::date`;

/** Postgres tekillik ihlali (paket_okutmalari_sirket_barkod_uq). */
function benzersizIhlaliMi(hata: unknown): boolean {
  let o: unknown = hata;
  for (let i = 0; i < 4 && o; i += 1) {
    if (typeof o === "object" && (o as { code?: string }).code === "23505") {
      return true;
    }
    o = (o as { cause?: unknown }).cause;
  }
  return false;
}

/** Mükerrer okutmayı işlemin dışında yeniden okumak için kullanılan işaret. */
class MukerrerYarisi extends Error {}

export interface MevcutOkutma {
  okutanAd: string;
  okutmaZamani: Date;
  kullaniciId: string;
  profilGorsel: string | null;
}

/** (sirket, barkod) ile mevcut okutma - "kim okuttu" perdesinin kaynağı. */
async function mevcutOkutma(
  islem: Islem,
  sirketId: string,
  barkod: string,
): Promise<MevcutOkutma | null> {
  const [satir] = await islem
    .select({
      okutanAd: paketOkutmalari.okutanAd,
      okutmaZamani: paketOkutmalari.okutmaZamani,
      kullaniciId: paketOkutmalari.kullaniciId,
      profilGorsel: kullanicilar.profilGorsel,
    })
    .from(paketOkutmalari)
    .leftJoin(kullanicilar, eq(kullanicilar.id, paketOkutmalari.kullaniciId))
    .where(
      and(
        eq(paketOkutmalari.sirketId, sirketId),
        eq(paketOkutmalari.barkod, barkod),
      ),
    )
    .limit(1);

  if (!satir) return null;
  return {
    okutanAd: satir.okutanAd,
    okutmaZamani: satir.okutmaZamani,
    kullaniciId: satir.kullaniciId,
    profilGorsel: satir.profilGorsel ?? null,
  };
}

/**
 * ORTAK KAYIT YARDIMCISI - hem hızlı/rehberli okutma hem toplama modunun
 * paketleme adımı aynı satırı yazar (PartnerSys `recordPackageScan` portu).
 * Tekillik ihlali HATA DEĞİLDİR: `mukerrer: true` döner, çağıran akışına göre
 * karar verir.
 */
export async function okutmaSatiriEkle(
  islem: Islem,
  k: Kapsam,
  barkod: string,
  bilgi: BarkodBilgisi,
  entegrasyonAdi: string | null,
): Promise<{ mukerrer: boolean }> {
  try {
    /* `onConflictDoNothing` BİLEREK: çakışma bir HATA olarak dönseydi içinde
       bulunduğumuz işlem Postgres tarafından iptal edilir ve aynı işlemdeki
       diğer yazımlar (toplama modunda siparişin hazır damgası) geri alınırdı.
       Böylece mükerrer, akışı bozmayan sıradan bir sonuç olur. */
    const eklenen = await islem
      .insert(paketOkutmalari)
      .values({
        sirketId: k.sirketId,
        kullaniciId: k.kullaniciId,
        barkod,
        // Denormalize ad: kullanıcı silinse de listede kim okuttuğu kalır.
        okutanAd: k.ad,
        kaynak: bilgi.kaynak,
        kargoFirmasi: bilgi.kargoFirmasi,
        entegrasyonAdi,
      })
      .onConflictDoNothing({
        target: [paketOkutmalari.sirketId, paketOkutmalari.barkod],
      })
      .returning({ id: paketOkutmalari.id });
    return { mukerrer: eklenen.length === 0 };
  } catch (hata) {
    // Emniyet kemeri: çakışma başka bir kısıttan gelirse de mükerrer sayılır.
    if (benzersizIhlaliMi(hata)) return { mukerrer: true };
    throw hata;
  }
}

/**
 * PAKET OKUT - tek işlemde: mükerrer kontrolü → sipariş engeli → barkod
 * çözümü → kayıt → siparişi hazır işaretle.
 *
 * Neden tek işlem: paket kaydı yazılıp sipariş işaretlenemezse depo "bu paket
 * okutuldu ama sipariş hâlâ bekliyor" durumuna düşerdi. İkisi birlikte olur
 * ya da hiç olmaz.
 *
 * ENGELLER hiçbir şey YAZMAZ: iptal edilmiş ya da kargolanmış sipariş
 * okutulduğunda kayıt atılmaz, kullanıcı tam ekran uyarı görür.
 */
export async function okutmaKaydet(
  k: Kapsam,
  barkod: string,
  entegrasyonAdi?: string,
): Promise<OkutmaSonucu> {
  const sirketId = k.sirketId;

  try {
    return await db.transaction(async (tx) => {
      /* 1) Daha önce okutulmuş mu? */
      const mevcut = await mevcutOkutma(tx, sirketId, barkod);
      if (mevcut) {
        return {
          sonuc: "mukerrer" as const,
          barkod,
          mevcut: {
            okutanAd: mevcut.okutanAd,
            okutmaZamani: mevcut.okutmaZamani.toISOString(),
            ayniKullanici: mevcut.kullaniciId === k.kullaniciId,
            profilGorsel: mevcut.profilGorsel,
          },
        };
      }

      /* 2) Pazaryeri siparişi engel mi? */
      const siparis = await takipNoIleSiparis(sirketId, barkod);
      if (siparis) {
        const engel = okutmaEngeli(siparis.durum);
        if (engel) {
          return {
            sonuc: engel,
            barkod,
            siparis: {
              siparisNo: siparis.siparisNo,
              platform: siparis.platform,
              entegrasyonAdi: siparis.entegrasyonAdi,
            },
          };
        }
      }

      /* 3) Kaynak/kargo çözümü (60 sn önbellekli kural listesi). */
      const bilgi = await barkodCoz(sirketId, barkod);

      /* 4) Kayıt. Yarışta tekillik ihlali gelirse işlemi geri alıp
            mükerrer cevabı işlem DIŞINDA üretilir (hata alan işlem
            içinde başka sorgu çalıştırılamaz). */
      const { mukerrer } = await okutmaSatiriEkle(
        tx,
        k,
        barkod,
        bilgi,
        entegrasyonAdi ?? siparis?.entegrasyonAdi ?? null,
      );
      if (mukerrer) throw new MukerrerYarisi();

      /* 5) Siparişi hazır işaretle (varsa). */
      await hazirIsaretle(tx, sirketId, barkod);

      /* Uyarı kararı: kargo çözülemediyse her şeyin önünde o söylenir.
         Pazaryeri barkodu olup siparişi bulunamayan paket, o pazaryeri bağlıysa
         varsa "senkron gecikmiş olabilir" uyarısı alır - ama kaydedilir. */
      let uyari: OkutmaUyarisi | undefined;
      if (bilgi.bilinmiyor) {
        uyari = "bilinmeyen_kargo";
      } else if (
        !siparis &&
        kaynaktanPlatform(bilgi.kaynak) !== null &&
        (await aktifEntegrasyonVarMi(sirketId, kaynaktanPlatform(bilgi.kaynak)))
      ) {
        uyari = "siparis_yok";
      }

      return {
        sonuc: "kaydedildi" as const,
        barkod,
        kaynak: bilgi.kaynak,
        kargoFirmasi: bilgi.kargoFirmasi,
        ...(uyari ? { uyari } : {}),
        rehberli: siparis
          ? { siparisNo: siparis.siparisNo, kalemler: siparis.kalemler }
          : null,
      };
    });
  } catch (hata) {
    if (!(hata instanceof MukerrerYarisi)) throw hata;

    const mevcut = await mevcutOkutma(db, sirketId, barkod);
    return {
      sonuc: "mukerrer",
      barkod,
      mevcut: {
        okutanAd: mevcut?.okutanAd ?? "-",
        okutmaZamani: (mevcut?.okutmaZamani ?? new Date()).toISOString(),
        ayniKullanici: mevcut?.kullaniciId === k.kullaniciId,
        profilGorsel: mevcut?.profilGorsel ?? null,
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

export interface PaketSatiri {
  id: string;
  barkod: string;
  /** ISO 8601 - istemciye seri hâlde iner. */
  okutmaZamani: string;
  okutanAd: string;
  kaynak: string | null;
  kargoFirmasi: string | null;
  entegrasyonAdi: string | null;
  kullaniciId: string;
  profilGorsel: string | null;
}

export interface PaketSayfasi {
  satirlar: PaketSatiri[];
  toplam: number;
  sayfa: number;
  limit: number;
}

/**
 * Filtre koşulları. `calisan` rolünde kullanıcı filtresi ZORLA kendi
 * kimliğine çekilir: adres çubuğuna başka bir kimlik yazmak işe yaramaz.
 */
function kosullar(k: Kapsam, f: PaketFiltreleri): SQL[] {
  const liste: SQL[] = [eq(paketOkutmalari.sirketId, k.sirketId)];

  const kullaniciId = k.rol === "calisan" ? k.kullaniciId : f.kullanici;
  if (kullaniciId) liste.push(eq(paketOkutmalari.kullaniciId, kullaniciId));

  if (f.arama) {
    // Barkod aramasında joker karakterler kaçırılır: "%" yazan kullanıcı
    // tabloyu taramasın.
    const desen = `%${f.arama.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    liste.push(sql`${paketOkutmalari.barkod} ILIKE ${desen}`);
  }
  if (f.kaynak) liste.push(eq(paketOkutmalari.kaynak, f.kaynak));
  if (f.kargo) liste.push(eq(paketOkutmalari.kargoFirmasi, f.kargo));
  if (f.baslangic) liste.push(sql`${ISTANBUL_GUN} >= ${f.baslangic}::date`);
  if (f.bitis) liste.push(sql`${ISTANBUL_GUN} <= ${f.bitis}::date`);

  return liste;
}

function satirCevir(s: {
  id: string;
  barkod: string;
  okutmaZamani: Date;
  okutanAd: string;
  kaynak: string | null;
  kargoFirmasi: string | null;
  entegrasyonAdi: string | null;
  kullaniciId: string;
  profilGorsel: string | null;
}): PaketSatiri {
  return { ...s, okutmaZamani: s.okutmaZamani.toISOString() };
}

/** Sayfalı paket listesi. `sayfa` 0 tabanlıdır. */
export async function sayfa(
  k: Kapsam,
  filtreler: PaketFiltreleri,
  sayfaNo = 0,
  limit = 50,
): Promise<PaketSayfasi> {
  const kosul = and(...kosullar(k, filtreler));

  const [satirlar, [toplamSatiri]] = await Promise.all([
    db
      .select({
        id: paketOkutmalari.id,
        barkod: paketOkutmalari.barkod,
        okutmaZamani: paketOkutmalari.okutmaZamani,
        okutanAd: paketOkutmalari.okutanAd,
        kaynak: paketOkutmalari.kaynak,
        kargoFirmasi: paketOkutmalari.kargoFirmasi,
        entegrasyonAdi: paketOkutmalari.entegrasyonAdi,
        kullaniciId: paketOkutmalari.kullaniciId,
        profilGorsel: kullanicilar.profilGorsel,
      })
      .from(paketOkutmalari)
      .leftJoin(kullanicilar, eq(kullanicilar.id, paketOkutmalari.kullaniciId))
      .where(kosul)
      .orderBy(desc(paketOkutmalari.okutmaZamani))
      .limit(limit)
      .offset(sayfaNo * limit),
    db.select({ adet: count() }).from(paketOkutmalari).where(kosul),
  ]);

  return {
    satirlar: satirlar.map(satirCevir),
    toplam: toplamSatiri?.adet ?? 0,
    sayfa: sayfaNo,
    limit,
  };
}

export interface FiltreSecenekleri {
  kaynaklar: string[];
  kargolar: string[];
  kullanicilar: Array<{ id: string; ad: string }>;
}

/** Filtre açılırlarının içeriği - yalnız gerçekten kayıt geçmiş değerler. */
export async function filtreSecenekleri(k: Kapsam): Promise<FiltreSecenekleri> {
  const kapsamKosulu =
    k.rol === "calisan"
      ? and(
          eq(paketOkutmalari.sirketId, k.sirketId),
          eq(paketOkutmalari.kullaniciId, k.kullaniciId),
        )
      : eq(paketOkutmalari.sirketId, k.sirketId);

  const [kaynaklar, kargolar, kisiler] = await Promise.all([
    db
      .selectDistinct({ deger: paketOkutmalari.kaynak })
      .from(paketOkutmalari)
      .where(kapsamKosulu),
    db
      .selectDistinct({ deger: paketOkutmalari.kargoFirmasi })
      .from(paketOkutmalari)
      .where(kapsamKosulu),
    db
      .selectDistinct({
        id: paketOkutmalari.kullaniciId,
        ad: paketOkutmalari.okutanAd,
      })
      .from(paketOkutmalari)
      .where(kapsamKosulu),
  ]);

  const metinler = (satirlar: Array<{ deger: string | null }>) =>
    satirlar
      .map((s) => s.deger)
      .filter((d): d is string => !!d)
      .sort((a, b) => a.localeCompare(b, "tr"));

  return {
    kaynaklar: metinler(kaynaklar),
    kargolar: metinler(kargolar),
    kullanicilar: kisiler
      .map((s) => ({ id: s.id, ad: s.ad }))
      .sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
  };
}

/* ------------------------------------------------------------------ */
/* Silme (yalnız yönetici)                                             */
/* ------------------------------------------------------------------ */

/**
 * Tek paket silme. Yetki kapısı server action'da açılır; burada İKİNCİ kez
 * kontrol edilir (repo doğrudan çağrılırsa da kiracı ve rol korunsun).
 */
export async function sil(k: Kapsam, id: string): Promise<number> {
  if (!adminMi(k.rol)) return 0;
  const satirlar = await db
    .delete(paketOkutmalari)
    .where(
      and(eq(paketOkutmalari.id, id), eq(paketOkutmalari.sirketId, k.sirketId)),
    )
    .returning({ id: paketOkutmalari.id });
  return satirlar.length;
}

/** Toplu silme - seçili satırlar, yalnız kendi şirketinden. */
export async function topluSil(k: Kapsam, idler: string[]): Promise<number> {
  if (!adminMi(k.rol) || idler.length === 0) return 0;
  const satirlar = await db
    .delete(paketOkutmalari)
    .where(
      and(
        inArray(paketOkutmalari.id, idler),
        eq(paketOkutmalari.sirketId, k.sirketId),
      ),
    )
    .returning({ id: paketOkutmalari.id });
  return satirlar.length;
}

/* ------------------------------------------------------------------ */
/* Okutma ekranı özetleri                                              */
/* ------------------------------------------------------------------ */

export interface BugunKullanici {
  kullaniciId: string;
  ad: string;
  profilGorsel: string | null;
  adet: number;
}

export interface BugunOzeti {
  toplam: number;
  kullanicilar: BugunKullanici[];
}

/**
 * Bugünün (Europe/Istanbul takvim günü) kullanıcı bazlı okutma sayıları.
 * Ekranda sıralama olarak görünür; şirketin TAMAMI gösterilir çünkü tablo
 * ortak bir performans göstergesidir.
 */
export async function bugunOzet(sirketId: string): Promise<BugunOzeti> {
  const bugun = gunAnahtari();
  const satirlar = await db
    .select({
      kullaniciId: paketOkutmalari.kullaniciId,
      ad: paketOkutmalari.okutanAd,
      profilGorsel: kullanicilar.profilGorsel,
      adet: count(),
    })
    .from(paketOkutmalari)
    .leftJoin(kullanicilar, eq(kullanicilar.id, paketOkutmalari.kullaniciId))
    .where(
      and(
        eq(paketOkutmalari.sirketId, sirketId),
        sql`${ISTANBUL_GUN} = ${bugun}::date`,
      ),
    )
    .groupBy(
      paketOkutmalari.kullaniciId,
      paketOkutmalari.okutanAd,
      kullanicilar.profilGorsel,
    );

  const liste = satirlar
    .map((s) => ({
      kullaniciId: s.kullaniciId,
      ad: s.ad,
      profilGorsel: s.profilGorsel ?? null,
      adet: s.adet,
    }))
    .sort((a, b) => b.adet - a.adet);

  return {
    toplam: liste.reduce((t, s) => t + s.adet, 0),
    kullanicilar: liste,
  };
}

/** Okutma ekranının açılışta gösterdiği son satırlar. */
export async function sonOkutmalar(
  k: Kapsam,
  limit = 20,
): Promise<PaketSatiri[]> {
  const kapsamKosulu =
    k.rol === "calisan"
      ? and(
          eq(paketOkutmalari.sirketId, k.sirketId),
          eq(paketOkutmalari.kullaniciId, k.kullaniciId),
        )
      : eq(paketOkutmalari.sirketId, k.sirketId);

  const satirlar = await db
    .select({
      id: paketOkutmalari.id,
      barkod: paketOkutmalari.barkod,
      okutmaZamani: paketOkutmalari.okutmaZamani,
      okutanAd: paketOkutmalari.okutanAd,
      kaynak: paketOkutmalari.kaynak,
      kargoFirmasi: paketOkutmalari.kargoFirmasi,
      entegrasyonAdi: paketOkutmalari.entegrasyonAdi,
      kullaniciId: paketOkutmalari.kullaniciId,
      profilGorsel: kullanicilar.profilGorsel,
    })
    .from(paketOkutmalari)
    .leftJoin(kullanicilar, eq(kullanicilar.id, paketOkutmalari.kullaniciId))
    .where(kapsamKosulu)
    .orderBy(desc(paketOkutmalari.okutmaZamani))
    .limit(limit);

  return satirlar.map(satirCevir);
}
