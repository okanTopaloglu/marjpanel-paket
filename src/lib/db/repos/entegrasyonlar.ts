import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { entegrasyonlar, sirketler, type Entegrasyon } from "@/lib/db/schema";
import { coz } from "@/lib/guvenlik/sifreleme";
import type { Kapsam } from "@/lib/auth/kapsam";
import { PAZARYERLERI, platformMi } from "@/lib/pazaryeri/kayit";
import {
  hesapKimligi,
  kimlikBirlestir,
  kimlikCoz,
  kimlikMaskele,
  kimlikSifrele,
  type Kimlik,
} from "@/lib/pazaryeri/kimlik";
import type { Platform } from "@/lib/pazaryeri/tipler";

/**
 * ENTEGRASYON REPOSU — pazaryeri API bağlantıları.
 *
 * İKİ AYRI OKUMA YÜZEYİ VARDIR ve karıştırılmamalıdır:
 *
 *  · `listele` → ARAYÜZ. Kimlik MASKELİ döner (gizli alanlar `abc****xyz`).
 *    Çözülmüş anahtar hiçbir zaman sayfaya, server action dönüşüne ya da
 *    JSON'a konmaz; maskeleme bu dosyada yapılır ki çağıran "unutması"
 *    mümkün olmasın.
 *  · `kimlikBilgileri` / `aktifler` / `vadesiGelenler` → SENKRON MOTORU.
 *    Çözülmüş kimlik taşır, YALNIZ sunucu içinde kalır.
 *
 * KİMLİK TEK ŞİFRELİ JSON SÜTUNUNDADIR (`kimlik_sifreli`, lib/pazaryeri/
 * kimlik). Eski `api_key_sifreli`/`api_secret_sifreli` sütunları yalnız
 * kimlik_sifreli BOŞ olan Trendyol satırları için okunur (bu değişiklikten
 * önce yazılmış kayıt); yeni kayıt oraya yazılmaz.
 *
 * Şifre çözümü `APP_ENCRYPTION_KEY` değiştiğinde hata fırlatır. Motor
 * yüzeyleri bu satırı ATLAR (tüm senkronu düşürmek yerine o entegrasyonu
 * yok sayar) ve konsola tek satır uyarı yazar.
 */

export class EntegrasyonCakismasi extends Error {
  constructor() {
    super("Bu hesap kimliği bu şirkette zaten kayıtlı.");
    this.name = "EntegrasyonCakismasi";
  }
}

export class EntegrasyonLimiti extends Error {
  constructor(readonly azami: number) {
    super(
      `En fazla ${azami} entegrasyon ekleyebilirsiniz. Limit artırımı için yönetici ile görüşün.`,
    );
    this.name = "EntegrasyonLimiti";
  }
}

export class EntegrasyonYok extends Error {
  constructor() {
    super("Entegrasyon bulunamadı.");
    this.name = "EntegrasyonYok";
  }
}

export class PlatformGecersiz extends Error {
  constructor(platform: string) {
    super(`Tanınmayan ya da henüz hazır olmayan pazaryeri: ${platform}.`);
    this.name = "PlatformGecersiz";
  }
}

/** Arayüze inen kayıt: kimlik MASKELİ. */
export interface EntegrasyonOzeti {
  id: string;
  platform: Platform;
  ad: string | null;
  saticiId: string;
  /** Gizli alanlar maskeli, metin alanlar açık (`kayit.ts` alan sırasıyla). */
  kimlikMaskeli: Kimlik;
  aktif: boolean;
  sonSiparisSenkron: Date | null;
  sonUrunSenkron: Date | null;
  sonHata: string | null;
  sonHataZamani: Date | null;
  ertelemeBitis: Date | null;
}

/** Senkron motoruna inen kayıt: kimlik ÇÖZÜLMÜŞ (yalnız sunucu). */
export interface SenkronEntegrasyonu {
  id: string;
  sirketId: string;
  platform: Platform;
  ad: string;
  saticiId: string;
  kimlik: Kimlik;
  ayarlar: Record<string, unknown>;
  sonSiparisSenkron: Date | null;
  sonUrunSenkron: Date | null;
  sonGenisTarama: Date | null;
}

function tekillikIhlaliMi(hata: unknown): boolean {
  let h: unknown = hata;
  for (let i = 0; i < 5 && h; i++) {
    const o = h as { code?: unknown; cause?: unknown };
    if (o.code === "23505") return true;
    h = o.cause;
  }
  return false;
}

/** Görünen ad: kullanıcı ad vermediyse platform adına düşer. */
function gorunenAd(satir: { ad: string | null; platform: string }): string {
  return satir.ad?.trim() || (platformMi(satir.platform) ? PAZARYERLERI[satir.platform].ad : satir.platform);
}

function ayarlariOku(satir: Entegrasyon): Record<string, unknown> {
  const a = satir.ayarlar;
  return a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
}

/**
 * Satırın çözülmüş kimliği. `kimlik_sifreli` varsa JSON; yoksa eski iki
 * sütundan Trendyol kimliği kurulur. Çözülemezse fırlatır.
 */
function kimligiCoz(satir: Entegrasyon): Kimlik {
  if (satir.kimlikSifreli) return kimlikCoz(satir.kimlikSifreli);
  if (satir.apiKeySifreli && satir.apiSecretSifreli) {
    return {
      saticiId: satir.saticiId,
      apiKey: coz(satir.apiKeySifreli),
      apiSecret: coz(satir.apiSecretSifreli),
    };
  }
  throw new Error("Kimlik sütunu boş.");
}

/** Satırı motor biçimine çevirir; kimlik çözülemezse `null` (satır atlanır). */
function motorKaydi(satir: Entegrasyon): SenkronEntegrasyonu | null {
  if (!platformMi(satir.platform)) {
    console.warn(`[senkron] Entegrasyon ${satir.id}: tanınmayan platform "${satir.platform}"; atlanıyor.`);
    return null;
  }
  try {
    return {
      id: satir.id,
      sirketId: satir.sirketId,
      platform: satir.platform,
      ad: gorunenAd(satir),
      saticiId: satir.saticiId,
      kimlik: kimligiCoz(satir),
      ayarlar: ayarlariOku(satir),
      sonSiparisSenkron: satir.sonSiparisSenkron,
      sonUrunSenkron: satir.sonUrunSenkron,
      sonGenisTarama: satir.sonGenisTarama,
    };
  } catch {
    console.warn(
      `[senkron] Entegrasyon ${satir.id}: kimlik çözülemedi (APP_ENCRYPTION_KEY değişmiş olabilir); atlanıyor.`,
    );
    return null;
  }
}

/** Erteleme süresi dolmamış satırlar motor yüzeylerinden dışarıda kalır. */
const ERTELEME_GECTI = sql`(${entegrasyonlar.ertelemeBitis} is null or ${entegrasyonlar.ertelemeBitis} < now())`;

/* ------------------------------------------------------------------ */
/* Arayüz yüzeyi                                                       */
/* ------------------------------------------------------------------ */

export async function listele(sirketId: string): Promise<EntegrasyonOzeti[]> {
  const satirlar = await db
    .select()
    .from(entegrasyonlar)
    .where(eq(entegrasyonlar.sirketId, sirketId))
    .orderBy(asc(entegrasyonlar.platform), asc(entegrasyonlar.createdAt));

  return satirlar
    .filter((s): s is Entegrasyon & { platform: Platform } => platformMi(s.platform))
    .map((s) => {
      let maskeli: Kimlik;
      try {
        maskeli = kimlikMaskele(s.platform, kimligiCoz(s));
      } catch {
        maskeli = { [PAZARYERLERI[s.platform].hesapKimligiAlani]: s.saticiId };
      }
      return {
        id: s.id,
        platform: s.platform,
        ad: s.ad,
        saticiId: s.saticiId,
        kimlikMaskeli: maskeli,
        aktif: s.aktif,
        sonSiparisSenkron: s.sonSiparisSenkron,
        sonUrunSenkron: s.sonUrunSenkron,
        sonHata: s.sonHata,
        sonHataZamani: s.sonHataZamani,
        ertelemeBitis: s.ertelemeBitis,
      };
    });
}

export interface KaydetGirdisi {
  /** Dolu ise düzenleme, boş ise yeni kayıt. */
  id?: string;
  /** Yeni kayıtta zorunlu; düzenlemede satırdakinden okunur. */
  platform?: string;
  ad?: string | null;
  /** Platformun alanları (`kayit.ts`); düzenlemede boş gizli alan eskisini korur. */
  kimlik: Kimlik;
}

/**
 * Ekler ya da günceller.
 *
 * DÜZENLEMEDE BOŞ GİZLİ ALAN ESKİSİNİ KORUR: form anahtarları maskeli
 * gösterir (düz metin hiç inmez), dolayısıyla kullanıcı adı değiştirmek için
 * formu kaydettiğinde anahtar alanı boştur. Boşu "sil" saymak her düzenlemede
 * entegrasyonu bozardı. Platform DÜZENLEMEDE DEĞİŞMEZ: siparişler platform
 * anahtarıyla yazıldı, mağaza başka pazaryerine "taşınamaz".
 */
export async function kaydet(k: Kapsam, girdi: KaydetGirdisi): Promise<{ id: string }> {
  const ad = girdi.ad?.trim() || null;

  if (girdi.id) {
    const [mevcut] = await db
      .select()
      .from(entegrasyonlar)
      .where(and(eq(entegrasyonlar.id, girdi.id), eq(entegrasyonlar.sirketId, k.sirketId)))
      .limit(1);
    if (!mevcut) throw new EntegrasyonYok();
    if (!platformMi(mevcut.platform)) throw new PlatformGecersiz(mevcut.platform);

    let eski: Kimlik = {};
    try {
      eski = kimligiCoz(mevcut);
    } catch {
      /* çözülemeyen eski kimlik: yeni değerler tamamen ezer */
    }
    const kimlik = kimlikBirlestir(PAZARYERLERI[mevcut.platform].alanlar, eski, girdi.kimlik);
    const hesap = hesapKimligi(mevcut.platform, kimlik);
    if (!hesap) throw new Error("Hesap kimliği boş olamaz.");

    try {
      await db
        .update(entegrasyonlar)
        .set({
          ad,
          saticiId: hesap,
          kimlikSifreli: kimlikSifrele(kimlik),
          // Eski sütunlar artık okunmaz; boşaltılır ki iki kaynak ayrı düşmesin.
          apiKeySifreli: null,
          apiSecretSifreli: null,
          updatedAt: new Date(),
        })
        .where(eq(entegrasyonlar.id, mevcut.id));
    } catch (hata) {
      if (tekillikIhlaliMi(hata)) throw new EntegrasyonCakismasi();
      throw hata;
    }
    return { id: mevcut.id };
  }

  // Yeni kayıt: platform hazır olmalı, alanlar dolu olmalı, limit kontrol edilir.
  const platform = girdi.platform ?? "";
  if (!platformMi(platform) || !PAZARYERLERI[platform].hazir) throw new PlatformGecersiz(platform);

  const kimlik: Kimlik = {};
  for (const alan of PAZARYERLERI[platform].alanlar) {
    const v = girdi.kimlik[alan.ad]?.trim() ?? "";
    if (alan.zorunlu && !v) throw new Error(`${alan.etiket} zorunludur.`);
    kimlik[alan.ad] = v;
  }
  const hesap = hesapKimligi(platform, kimlik);
  if (!hesap) throw new Error("Hesap kimliği boş olamaz.");

  const [sirket] = await db
    .select({ azami: sirketler.azamiEntegrasyon })
    .from(sirketler)
    .where(eq(sirketler.id, k.sirketId))
    .limit(1);

  if (sirket?.azami != null) {
    const [sayim] = await db
      .select({ adet: sql<number>`count(*)::int` })
      .from(entegrasyonlar)
      .where(eq(entegrasyonlar.sirketId, k.sirketId));
    if ((sayim?.adet ?? 0) >= sirket.azami) throw new EntegrasyonLimiti(sirket.azami);
  }

  try {
    const [satir] = await db
      .insert(entegrasyonlar)
      .values({
        sirketId: k.sirketId,
        platform,
        ad,
        saticiId: hesap,
        kimlikSifreli: kimlikSifrele(kimlik),
      })
      .returning({ id: entegrasyonlar.id });
    if (!satir) throw new Error("Entegrasyon kaydedilemedi.");
    return { id: satir.id };
  } catch (hata) {
    if (tekillikIhlaliMi(hata)) throw new EntegrasyonCakismasi();
    throw hata;
  }
}

export async function sil(k: Kapsam, id: string): Promise<boolean> {
  const silinen = await db
    .delete(entegrasyonlar)
    .where(and(eq(entegrasyonlar.id, id), eq(entegrasyonlar.sirketId, k.sirketId)))
    .returning({ id: entegrasyonlar.id });
  return silinen.length > 0;
}

/**
 * Çözülmüş kimlik bilgileri — YALNIZ SUNUCU.
 *
 * `sirketId` verilirse kayıt o kiracıyla sınırlanır (server action'lar bunu
 * HER ZAMAN verir). Zamanlayıcı şirketler arası çalıştığı için parametresiz
 * çağırabilir.
 */
export async function kimlikBilgileri(
  id: string,
  sirketId?: string,
): Promise<SenkronEntegrasyonu | null> {
  const [satir] = await db
    .select()
    .from(entegrasyonlar)
    .where(
      sirketId
        ? and(eq(entegrasyonlar.id, id), eq(entegrasyonlar.sirketId, sirketId))
        : eq(entegrasyonlar.id, id),
    )
    .limit(1);
  return satir ? motorKaydi(satir) : null;
}

/* ------------------------------------------------------------------ */
/* Senkron motoru yüzeyi                                               */
/* ------------------------------------------------------------------ */

/** Tüm şirketlerin aktif entegrasyonları (zamanlayıcı kiracı gözetmez). */
export async function aktifler(): Promise<SenkronEntegrasyonu[]> {
  const satirlar = await db
    .select()
    .from(entegrasyonlar)
    .where(eq(entegrasyonlar.aktif, true))
    .orderBy(asc(entegrasyonlar.createdAt));
  return satirlar.map(motorKaydi).filter((s): s is SenkronEntegrasyonu => s !== null);
}

/**
 * Sipariş senkronunun VADESİ GELEN entegrasyonları.
 *
 * Aralık ŞİRKET BAŞINADIR (`sirketler.senkron_aralik_dk`, 2..60): bir müşteri
 * 2 dakikada bir çekerken diğeri saatte bir çekebilsin. Karşılaştırma SQL'de
 * yapılır — uygulamada yapmak tüm entegrasyonları belleğe çekmek olurdu.
 * Ertelemesi (429/401 sonrası) dolmamış satırlar dışarıda kalır.
 */
export async function vadesiGelenler(simdi: Date = new Date()): Promise<SenkronEntegrasyonu[]> {
  const satirlar = await db
    .select({ e: entegrasyonlar })
    .from(entegrasyonlar)
    .innerJoin(sirketler, eq(sirketler.id, entegrasyonlar.sirketId))
    .where(
      and(
        eq(entegrasyonlar.aktif, true),
        ERTELEME_GECTI,
        /*
         * Zaman parametresi ISO METİN olarak geçilir ve `::timestamptz` ile
         * dönüştürülür. Ham `Date` nesnesi, sütun tipi bilinmeyen bir `sql`
         * parçasında sürücüye (postgres.js) doğrudan iner ve "string argument
         * expected, received Date" ile patlar - senkron bu yüzden hiç
         * başlamıyordu.
         */
        sql`(
          ${entegrasyonlar.sonSiparisSenkron} is null
          or ${entegrasyonlar.sonSiparisSenkron} < ${simdi.toISOString()}::timestamptz - (${sirketler.senkronAralikDk} * interval '1 minute')
        )`,
      ),
    )
    .orderBy(asc(entegrasyonlar.sonSiparisSenkron));

  return satirlar.map((s) => motorKaydi(s.e)).filter((s): s is SenkronEntegrasyonu => s !== null);
}

/** Ürün senkronu eşiği: 12 saat (PartnerSys ile aynı). */
export const URUN_SENKRON_ESIK_SAAT = 12;

export async function urunSenkronuVadesiGelenler(): Promise<SenkronEntegrasyonu[]> {
  const satirlar = await db
    .select()
    .from(entegrasyonlar)
    .where(
      and(
        eq(entegrasyonlar.aktif, true),
        ERTELEME_GECTI,
        sql`(
          ${entegrasyonlar.sonUrunSenkron} is null
          or ${entegrasyonlar.sonUrunSenkron} < now() - interval '${sql.raw(String(URUN_SENKRON_ESIK_SAAT))} hours'
        )`,
      ),
    )
    .orderBy(asc(entegrasyonlar.sonUrunSenkron));
  return satirlar
    .map(motorKaydi)
    .filter((s): s is SenkronEntegrasyonu => s !== null)
    // Ürün yeteneği olmayan platform (Amazon v1) ürün turuna girmez.
    .filter((s) => PAZARYERLERI[s.platform].yetenekler.urun);
}

/** Başarılı sipariş turu: zaman damgası + hata/erteleme temizliği. */
export async function sonSiparisSenkronGuncelle(id: string, tarih: Date = new Date()): Promise<void> {
  await db
    .update(entegrasyonlar)
    .set({ sonSiparisSenkron: tarih, sonHata: null, sonHataZamani: null, ertelemeBitis: null })
    .where(eq(entegrasyonlar.id, id));
}

export async function sonUrunSenkronGuncelle(id: string, tarih: Date = new Date()): Promise<void> {
  await db.update(entegrasyonlar).set({ sonUrunSenkron: tarih }).where(eq(entegrasyonlar.id, id));
}

export async function sonGenisTaramaGuncelle(id: string, tarih: Date = new Date()): Promise<void> {
  await db.update(entegrasyonlar).set({ sonGenisTarama: tarih }).where(eq(entegrasyonlar.id, id));
}

/**
 * Hata kaydı + isteğe bağlı erteleme. Entegrasyon PASİFE ALINMAZ: kullanıcı
 * kartta hatayı görür ve anahtarı düzeltir; otomatik pasifleştirme "neden
 * durdu" sorusunu sessizce bırakırdı.
 */
export async function sonHataYaz(id: string, mesaj: string, ertelemeSaniye = 0): Promise<void> {
  const simdi = new Date();
  await db
    .update(entegrasyonlar)
    .set({
      sonHata: mesaj.slice(0, 500),
      sonHataZamani: simdi,
      ertelemeBitis: ertelemeSaniye > 0 ? new Date(simdi.getTime() + ertelemeSaniye * 1000) : null,
    })
    .where(eq(entegrasyonlar.id, id));
}

/* ------------------------------------------------------------------ */
/* Senkron aralığı (şirket ayarı)                                      */
/* ------------------------------------------------------------------ */

export const ARALIK_ASGARI = 0.5;
export const ARALIK_AZAMI = 60;

export async function aralikOku(sirketId: string): Promise<number> {
  const [satir] = await db
    .select({ dk: sirketler.senkronAralikDk })
    .from(sirketler)
    .where(eq(sirketler.id, sirketId))
    .limit(1);
  const n = Number(satir?.dk ?? ARALIK_ASGARI);
  return Number.isFinite(n) ? n : ARALIK_ASGARI;
}

/** 0.5..60 dakika, yarım dakika adımlı; şemadaki CHECK ile aynı sınır. */
export async function aralikKaydet(k: Kapsam, dk: number): Promise<number> {
  const deger = Math.min(ARALIK_AZAMI, Math.max(ARALIK_ASGARI, Math.round(dk * 2) / 2));
  await db
    .update(sirketler)
    .set({ senkronAralikDk: String(deger), updatedAt: new Date() })
    .where(eq(sirketler.id, k.sirketId));
  return deger;
}
