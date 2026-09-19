import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  entegrasyonlar,
  kullanicilar,
  paketOkutmalari,
  pazaryeriSiparisleri,
  sirketler,
  type OkutmaModu,
  type Sirket,
} from "@/lib/db/schema";

/**
 * ŞİRKET REPOSU — kiracı kaydı.
 *
 * Üstteki blok kayıt akışının (kendi kendine kayıt) ihtiyacı; alttaki blok
 * M4 platform yönetimi CRUD'u (yalnız super_admin): listele, tekli getir,
 * güncelle, sil, özellik bayrakları.
 */

export type CakismaAlani = "sirketAd" | "alanAdi" | "telefon";

/**
 * Tekillik çakışması. Kayıt eylemi bunu yakalayıp KULLANICIYA ALAN BAZLI hata
 * gösterir; ham Postgres hatası hiçbir zaman arayüze sızmaz.
 */
export class CakismaHatasi extends Error {
  constructor(public readonly alan: CakismaAlani) {
    super(`Tekillik çakışması: ${alan}`);
    this.name = "CakismaHatasi";
  }
}

/** Drizzle hatayı sarmalayabiliyor; zincirde 23505 aranır. */
function tekillikIhlali(hata: unknown): { kod: string; kisit: string } | null {
  let h: unknown = hata;
  for (let i = 0; i < 5 && h; i++) {
    const o = h as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (o.code === "23505") {
      return { kod: "23505", kisit: String(o.constraint_name ?? "") };
    }
    h = o.cause;
  }
  return null;
}

/** Kısıt adı → alan eşlemesi (bkz. drizzle/0000_*.sql). */
function kisitAlani(kisit: string): CakismaAlani | null {
  if (kisit === "sirketler_ad_unique") return "sirketAd";
  if (kisit === "sirketler_alan_adi_unique") return "alanAdi";
  if (kisit === "kullanicilar_telefon_unique") return "telefon";
  return null;
}

/** Host (normalize) → şirket; kiracı çözümü (lib/kiraci/coz). */
export async function alanAdiIleGetir(alanAdi: string): Promise<Sirket | null> {
  if (!alanAdi) return null;
  const [satir] = await db.select().from(sirketler).where(eq(sirketler.alanAdi, alanAdi)).limit(1);
  return satir ?? null;
}

/**
 * Logo dosyasını ayarlar (null = kaldır); ESKİ dosya adını döner ki çağıran
 * diskten silsin. Kayıt önce, silme sonra: silme başarısız olsa bile veri
 * doğru kalır (sahipsiz dosya sonradan temizlenebilir).
 */
export async function logoAyarla(
  id: string,
  tur: "acik" | "koyu",
  dosyaAdi: string | null,
): Promise<string | null> {
  const sutun = tur === "acik" ? sirketler.logoDosya : sirketler.logoKoyuDosya;
  const [mevcut] = await db.select({ eski: sutun }).from(sirketler).where(eq(sirketler.id, id)).limit(1);
  if (!mevcut) throw new Error("Şirket bulunamadı.");
  await db
    .update(sirketler)
    .set(tur === "acik" ? { logoDosya: dosyaAdi, updatedAt: new Date() } : { logoKoyuDosya: dosyaAdi, updatedAt: new Date() })
    .where(eq(sirketler.id, id));
  return mevcut.eski ?? null;
}

export async function adIleGetir(ad: string): Promise<Sirket | null> {
  const [satir] = await db
    .select()
    .from(sirketler)
    .where(eq(sirketler.ad, ad))
    .limit(1);
  return satir ?? null;
}

export async function olustur(girdi: {
  ad: string;
  alanAdi?: string | null;
}): Promise<Sirket> {
  try {
    const [satir] = await db
      .insert(sirketler)
      .values({ ad: girdi.ad, alanAdi: girdi.alanAdi ?? null })
      .returning();
    if (!satir) throw new Error("Şirket oluşturulamadı.");
    return satir;
  } catch (hata) {
    const ihlal = tekillikIhlali(hata);
    const alan = ihlal ? kisitAlani(ihlal.kisit) : null;
    if (alan) throw new CakismaHatasi(alan);
    throw hata;
  }
}

/**
 * KAYIT: şirket + ilk yönetici TEK TRANSACTION'da.
 *
 * Neden transaction: şirket açılıp kullanıcı eklenememesi (telefon çakışması)
 * ortada sahipsiz bir kiracı bırakırdı ve aynı adla ikinci deneme bu kez
 * "şirket adı zaten var" diye reddedilirdi — kullanıcı hiçbir şekilde
 * kaydolamazdı. Hata hâlinde her şey geri alınır.
 *
 * İlk kullanıcı `admin` rolündedir: kendi şirketinin yöneticisidir. `super_admin`
 * platform sahibidir ve kayıt akışıyla ASLA üretilmez (yalnız seed/elle).
 */
export async function sirketVeYoneticiOlustur(girdi: {
  sirketAd: string;
  alanAdi?: string | null;
  ad: string;
  telefon: string;
  parolaHash: string;
}): Promise<{ sirketId: string; kullaniciId: string }> {
  try {
    return await db.transaction(async (tx) => {
      const [sirket] = await tx
        .insert(sirketler)
        .values({ ad: girdi.sirketAd, alanAdi: girdi.alanAdi ?? null })
        .returning({ id: sirketler.id });
      if (!sirket) throw new Error("Şirket oluşturulamadı.");

      const [kullanici] = await tx
        .insert(kullanicilar)
        .values({
          sirketId: sirket.id,
          telefon: girdi.telefon,
          parolaHash: girdi.parolaHash,
          ad: girdi.ad,
          rol: "admin",
        })
        .returning({ id: kullanicilar.id });
      if (!kullanici) throw new Error("Yönetici oluşturulamadı.");

      return { sirketId: sirket.id, kullaniciId: kullanici.id };
    });
  } catch (hata) {
    const ihlal = tekillikIhlali(hata);
    const alan = ihlal ? kisitAlani(ihlal.kisit) : null;
    if (alan) throw new CakismaHatasi(alan);
    throw hata;
  }
}

/* ==================================================================== */
/* PLATFORM YÖNETİMİ CRUD'U (M4) — yalnız super_admin                   */
/* ==================================================================== */

export interface SirketSayimli extends Sirket {
  kullaniciSayisi: number;
  okutmaSayisi: number;
  entegrasyonSayisi: number;
  siparisSayisi: number;
}

/**
 * Platformdaki tüm şirketler + sayımlar (şirketler ekranı). Her sayım
 * KORELE ALT SORGU: dört ayrı `count` sorgusu yerine tek turda gelir —
 * şirket sayısı arttıkça N+1'e düşmez.
 */
export async function listeleSayimlarla(): Promise<SirketSayimli[]> {
  return db
    .select({
      id: sirketler.id,
      ad: sirketler.ad,
      alanAdi: sirketler.alanAdi,
      markaAdi: sirketler.markaAdi,
      logoDosya: sirketler.logoDosya,
      logoKoyuDosya: sirketler.logoKoyuDosya,
      azamiEntegrasyon: sirketler.azamiEntegrasyon,
      faturaPaylasAcik: sirketler.faturaPaylasAcik,
      faturaKesimAcik: sirketler.faturaKesimAcik,
      mailAcik: sirketler.mailAcik,
      varsayilanOkutmaModu: sirketler.varsayilanOkutmaModu,
      senkronAralikDk: sirketler.senkronAralikDk,
      sevkKesimSaati: sirketler.sevkKesimSaati,
      createdAt: sirketler.createdAt,
      updatedAt: sirketler.updatedAt,
      kullaniciSayisi: sql<number>`(select count(*)::int from ${kullanicilar} where ${kullanicilar.sirketId} = ${sirketler.id})`,
      okutmaSayisi: sql<number>`(select count(*)::int from ${paketOkutmalari} where ${paketOkutmalari.sirketId} = ${sirketler.id})`,
      entegrasyonSayisi: sql<number>`(select count(*)::int from ${entegrasyonlar} where ${entegrasyonlar.sirketId} = ${sirketler.id})`,
      siparisSayisi: sql<number>`(select count(*)::int from ${pazaryeriSiparisleri} where ${pazaryeriSiparisleri.sirketId} = ${sirketler.id})`,
    })
    .from(sirketler)
    .orderBy(sirketler.ad);
}

export async function getir(id: string): Promise<Sirket | null> {
  const [satir] = await db.select().from(sirketler).where(eq(sirketler.id, id)).limit(1);
  return satir ?? null;
}

export async function guncelle(
  id: string,
  girdi: {
    ad?: string;
    alanAdi?: string | null;
    markaAdi?: string | null;
    azamiEntegrasyon?: number | null;
    faturaPaylasAcik?: boolean;
    faturaKesimAcik?: boolean;
    mailAcik?: boolean;
  },
): Promise<Sirket> {
  const set: Partial<typeof sirketler.$inferInsert> = { updatedAt: new Date() };
  if (girdi.ad !== undefined) set.ad = girdi.ad;
  if (girdi.alanAdi !== undefined) set.alanAdi = girdi.alanAdi;
  if (girdi.markaAdi !== undefined) set.markaAdi = girdi.markaAdi;
  if (girdi.azamiEntegrasyon !== undefined) set.azamiEntegrasyon = girdi.azamiEntegrasyon;
  if (girdi.faturaPaylasAcik !== undefined) set.faturaPaylasAcik = girdi.faturaPaylasAcik;
  if (girdi.faturaKesimAcik !== undefined) set.faturaKesimAcik = girdi.faturaKesimAcik;
  if (girdi.mailAcik !== undefined) set.mailAcik = girdi.mailAcik;

  try {
    const [satir] = await db
      .update(sirketler)
      .set(set)
      .where(eq(sirketler.id, id))
      .returning();
    if (!satir) throw new Error("Şirket bulunamadı.");
    return satir;
  } catch (hata) {
    const ihlal = tekillikIhlali(hata);
    const alan = ihlal ? kisitAlani(ihlal.kisit) : null;
    if (alan) throw new CakismaHatasi(alan);
    throw hata;
  }
}

/**
 * Şirket silme. "Kendi şirketini silme" YASAĞI burada DEĞİL, çağıran server
 * action'dadır (`sirketSil`) — repo yalnız `id` alır, hangi şirketin
 * "çağıranın kendi şirketi" olduğunu bilmez (o bilgi `Kapsam`'dadır).
 * Cascade (`onDelete: cascade`) kullanıcı/okutma/ürün/entegrasyon/sipariş
 * satırlarını otomatik temizler.
 */
export async function sil(id: string): Promise<void> {
  await db.delete(sirketler).where(eq(sirketler.id, id));
}

export interface SirketOzellikleriTam {
  faturaPaylasAcik: boolean;
  faturaKesimAcik: boolean;
  mailAcik: boolean;
  varsayilanOkutmaModu: OkutmaModu;
  azamiEntegrasyon: number | null;
}

/** Şirketin özellik bayrakları — entegrasyon/fatura ekranlarının kapı kontrolü için. */
export async function ozellikler(sirketId: string): Promise<SirketOzellikleriTam | null> {
  const [satir] = await db
    .select({
      faturaPaylasAcik: sirketler.faturaPaylasAcik,
      faturaKesimAcik: sirketler.faturaKesimAcik,
      mailAcik: sirketler.mailAcik,
      varsayilanOkutmaModu: sirketler.varsayilanOkutmaModu,
      azamiEntegrasyon: sirketler.azamiEntegrasyon,
    })
    .from(sirketler)
    .where(eq(sirketler.id, sirketId))
    .limit(1);
  return satir ?? null;
}

/** Sevk kesim saati (0..23); şemadaki CHECK ile aynı sınır. */
export async function sevkKesimSaatiAyarla(sirketId: string, saat: number): Promise<number> {
  const deger = Math.min(23, Math.max(0, Math.trunc(saat)));
  await db
    .update(sirketler)
    .set({ sevkKesimSaati: deger, updatedAt: new Date() })
    .where(eq(sirketler.id, sirketId));
  return deger;
}
