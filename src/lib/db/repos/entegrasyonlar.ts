import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { entegrasyonlar, sirketler, type Entegrasyon } from "@/lib/db/schema";
import { sifrele, coz, maskele } from "@/lib/guvenlik/sifreleme";
import type { Kapsam } from "@/lib/auth/kapsam";

/**
 * ENTEGRASYON REPOSU — pazaryeri API bağlantıları.
 *
 * İKİ AYRI OKUMA YÜZEYİ VARDIR ve karıştırılmamalıdır:
 *
 *  · `listele` → ARAYÜZ. Anahtarlar MASKELİ döner (`abc****xyz`). Çözülmüş
 *    anahtar hiçbir zaman sayfaya, server action dönüşüne ya da JSON'a
 *    konmaz; maskeleme bu dosyada yapılır ki çağıran "unutması" mümkün olmasın.
 *  · `kimlikBilgileri` / `aktifler` / `vadesiGelenler` → SENKRON MOTORU.
 *    Çözülmüş anahtar taşır, YALNIZ sunucu içinde kalır.
 *
 * Şifre çözümü `APP_ENCRYPTION_KEY` değiştiğinde hata fırlatır. Motor
 * yüzeyleri bu satırı ATLAR (tüm senkronu düşürmek yerine o entegrasyonu
 * yok sayar) ve konsola tek satır uyarı yazar.
 */

/** Şimdilik tek platform; şema `text` tutar ki yenisi şema göçü istemesin. */
export const TRENDYOL = "trendyol";

export class EntegrasyonCakismasi extends Error {
  constructor() {
    super("Bu satıcı kimliği bu şirkette zaten kayıtlı.");
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

/** Arayüze inen kayıt: anahtarlar MASKELİ. */
export interface EntegrasyonOzeti {
  id: string;
  platform: string;
  ad: string | null;
  saticiId: string;
  apiKeyMaskeli: string;
  aktif: boolean;
  sonSiparisSenkron: Date | null;
  sonUrunSenkron: Date | null;
}

/** Senkron motoruna inen kayıt: anahtarlar ÇÖZÜLMÜŞ (yalnız sunucu). */
export interface SenkronEntegrasyonu {
  id: string;
  sirketId: string;
  platform: string;
  ad: string;
  saticiId: string;
  apiKey: string;
  apiSecret: string;
  sonSiparisSenkron: Date | null;
  sonUrunSenkron: Date | null;
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
  return satir.ad?.trim() || satir.platform || "Trendyol";
}

/** Satırı motor biçimine çevirir; anahtar çözülemezse `null` (satır atlanır). */
function motorKaydi(satir: Entegrasyon): SenkronEntegrasyonu | null {
  try {
    return {
      id: satir.id,
      sirketId: satir.sirketId,
      platform: satir.platform,
      ad: gorunenAd(satir),
      saticiId: satir.saticiId,
      apiKey: coz(satir.apiKeySifreli),
      apiSecret: coz(satir.apiSecretSifreli),
      sonSiparisSenkron: satir.sonSiparisSenkron,
      sonUrunSenkron: satir.sonUrunSenkron,
    };
  } catch {
    console.warn(
      `[senkron] Entegrasyon ${satir.id}: API anahtarı çözülemedi (APP_ENCRYPTION_KEY değişmiş olabilir); atlanıyor.`,
    );
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Arayüz yüzeyi                                                       */
/* ------------------------------------------------------------------ */

export async function listele(sirketId: string): Promise<EntegrasyonOzeti[]> {
  const satirlar = await db
    .select()
    .from(entegrasyonlar)
    .where(eq(entegrasyonlar.sirketId, sirketId))
    .orderBy(asc(entegrasyonlar.platform), asc(entegrasyonlar.createdAt));

  return satirlar.map((s) => {
    let maskeli = "****";
    try {
      maskeli = maskele(coz(s.apiKeySifreli));
    } catch {
      maskeli = "(çözülemedi)";
    }
    return {
      id: s.id,
      platform: s.platform,
      ad: s.ad,
      saticiId: s.saticiId,
      apiKeyMaskeli: maskeli,
      aktif: s.aktif,
      sonSiparisSenkron: s.sonSiparisSenkron,
      sonUrunSenkron: s.sonUrunSenkron,
    };
  });
}

export interface KaydetGirdisi {
  /** Dolu ise düzenleme, boş ise yeni kayıt. */
  id?: string;
  ad?: string | null;
  saticiId: string;
  /** Düzenlemede boş bırakılırsa ESKİ anahtar korunur. */
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Ekler ya da günceller.
 *
 * DÜZENLEMEDE BOŞ ANAHTAR ESKİSİNİ KORUR: form anahtarları maskeli gösterir
 * (düz metin hiç inmez), dolayısıyla kullanıcı adı değiştirmek için formu
 * kaydettiğinde anahtar alanı boştur. Boşu "sil" saymak her düzenlemede
 * entegrasyonu bozardı.
 */
export async function kaydet(
  k: Kapsam,
  girdi: KaydetGirdisi,
): Promise<{ id: string }> {
  const saticiId = girdi.saticiId.trim();
  const ad = girdi.ad?.trim() || null;
  const apiKey = girdi.apiKey?.trim();
  const apiSecret = girdi.apiSecret?.trim();

  if (girdi.id) {
    const [mevcut] = await db
      .select()
      .from(entegrasyonlar)
      .where(
        and(
          eq(entegrasyonlar.id, girdi.id),
          eq(entegrasyonlar.sirketId, k.sirketId),
        ),
      )
      .limit(1);
    if (!mevcut) throw new EntegrasyonYok();

    try {
      await db
        .update(entegrasyonlar)
        .set({
          ad,
          saticiId,
          apiKeySifreli: apiKey ? sifrele(apiKey) : mevcut.apiKeySifreli,
          apiSecretSifreli: apiSecret ? sifrele(apiSecret) : mevcut.apiSecretSifreli,
          updatedAt: new Date(),
        })
        .where(eq(entegrasyonlar.id, mevcut.id));
    } catch (hata) {
      if (tekillikIhlaliMi(hata)) throw new EntegrasyonCakismasi();
      throw hata;
    }
    return { id: mevcut.id };
  }

  // Yeni kayıt: anahtarlar ZORUNLU (şema NOT NULL) ve limit kontrol edilir.
  if (!apiKey || !apiSecret) {
    throw new Error("API anahtarı ve gizli anahtar zorunludur.");
  }

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
        platform: TRENDYOL,
        ad,
        saticiId,
        apiKeySifreli: sifrele(apiKey),
        apiSecretSifreli: sifrele(apiSecret),
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
 */
export async function vadesiGelenler(
  simdi: Date = new Date(),
): Promise<SenkronEntegrasyonu[]> {
  const satirlar = await db
    .select({ e: entegrasyonlar })
    .from(entegrasyonlar)
    .innerJoin(sirketler, eq(sirketler.id, entegrasyonlar.sirketId))
    .where(
      and(
        eq(entegrasyonlar.aktif, true),
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

  return satirlar
    .map((s) => motorKaydi(s.e))
    .filter((s): s is SenkronEntegrasyonu => s !== null);
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
        sql`(
          ${entegrasyonlar.sonUrunSenkron} is null
          or ${entegrasyonlar.sonUrunSenkron} < now() - interval '${sql.raw(String(URUN_SENKRON_ESIK_SAAT))} hours'
        )`,
      ),
    )
    .orderBy(asc(entegrasyonlar.sonUrunSenkron));
  return satirlar.map(motorKaydi).filter((s): s is SenkronEntegrasyonu => s !== null);
}

export async function sonSiparisSenkronGuncelle(
  id: string,
  tarih: Date = new Date(),
): Promise<void> {
  await db
    .update(entegrasyonlar)
    .set({ sonSiparisSenkron: tarih })
    .where(eq(entegrasyonlar.id, id));
}

export async function sonUrunSenkronGuncelle(
  id: string,
  tarih: Date = new Date(),
): Promise<void> {
  await db
    .update(entegrasyonlar)
    .set({ sonUrunSenkron: tarih })
    .where(eq(entegrasyonlar.id, id));
}

/* ------------------------------------------------------------------ */
/* Senkron aralığı (şirket ayarı)                                      */
/* ------------------------------------------------------------------ */

export const ARALIK_ASGARI = 2;
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

/** 2..60 dakika; şemadaki CHECK ile aynı sınır (hata kullanıcıya inmesin). */
export async function aralikKaydet(k: Kapsam, dk: number): Promise<number> {
  const deger = Math.min(ARALIK_AZAMI, Math.max(ARALIK_ASGARI, Math.round(dk)));
  await db
    .update(sirketler)
    .set({ senkronAralikDk: String(deger), updatedAt: new Date() })
    .where(eq(sirketler.id, k.sirketId));
  return deger;
}
