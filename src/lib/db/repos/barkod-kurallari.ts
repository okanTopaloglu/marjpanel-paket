import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { barkodKurallari } from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";
import {
  kuralEslestir,
  type BarkodBilgisi,
  type EslesmeKurali,
} from "@/lib/barkod/coz";

/**
 * BARKOD KURALI REPOSU - okutma akışının en sıcak yolu.
 *
 * Her okutmada kural listesi okunsaydı, saniyede birkaç paket okutan bir
 * depoda aynı 12 satır sürekli sorgulanırdı. Kurallar NADİREN değişir
 * (yönetici ekranından elle), bu yüzden şirket başına 60 saniyelik süreç içi
 * önbellek tutulur. Kural CRUD'u yazıldığında `kuralOnbelleginiTemizle`
 * çağrılır ve değişiklik anında görünür.
 *
 * Önbellek SÜREÇ İÇİDİR: birden çok sunucu süreci varsa her biri kendi
 * kopyasını tutar, en kötü ihtimalle 60 saniye eski kuralla çalışır. Bu bilinçli
 * bir takas - alternatifi her okutmada bir sorgu daha.
 */

const ONBELLEK_OMRU_MS = 60_000;

interface OnbellekGirdisi {
  kurallar: EslesmeKurali[];
  zaman: number;
}

const onbellek = new Map<string, OnbellekGirdisi>();

/**
 * Global (sirket_id IS NULL) + şirkete özel aktif kurallar.
 * `sirketId` alanı korunur: `kurallariSirala` öncelik eşitliğinde şirket
 * kuralını globalin önüne alır.
 */
export async function etkinKurallar(sirketId: string): Promise<EslesmeKurali[]> {
  const satirlar = await db
    .select({
      barkodOneki: barkodKurallari.barkodOneki,
      kaynak: barkodKurallari.kaynak,
      kargoFirmasi: barkodKurallari.kargoFirmasi,
      oncelik: barkodKurallari.oncelik,
      aktif: barkodKurallari.aktif,
      sirketId: barkodKurallari.sirketId,
    })
    .from(barkodKurallari)
    .where(
      and(
        eq(barkodKurallari.aktif, true),
        or(
          isNull(barkodKurallari.sirketId),
          eq(barkodKurallari.sirketId, sirketId),
        ),
      ),
    );

  return satirlar.map((s) => ({
    barkodOneki: s.barkodOneki,
    kaynak: s.kaynak,
    kargoFirmasi: s.kargoFirmasi,
    oncelik: s.oncelik,
    aktif: s.aktif,
    sirketId: s.sirketId,
  }));
}

/** Önbellekli kural listesi. */
async function onbellekliKurallar(sirketId: string): Promise<EslesmeKurali[]> {
  const simdi = Date.now();
  const girdi = onbellek.get(sirketId);
  if (girdi && simdi - girdi.zaman < ONBELLEK_OMRU_MS) return girdi.kurallar;

  const kurallar = await etkinKurallar(sirketId);
  onbellek.set(sirketId, { kurallar, zaman: simdi });
  return kurallar;
}

/**
 * Barkod → kaynak/kargo. Eşleşme SAF fonksiyonda yapılır (`lib/barkod/coz`),
 * burada yalnız kural listesi beslenir.
 */
export async function barkodCoz(
  sirketId: string,
  barkod: string,
): Promise<BarkodBilgisi> {
  return kuralEslestir(await onbellekliKurallar(sirketId), barkod);
}

/**
 * Kural CRUD'u yazdıktan sonra çağrılır. `sirketId` verilmezse tüm önbellek
 * boşalır (global kural değişimi her şirketi etkiler).
 */
export function kuralOnbelleginiTemizle(sirketId?: string): void {
  if (sirketId) onbellek.delete(sirketId);
  else onbellek.clear();
}

/* ------------------------------------------------------------------ */
/* M4 - kural yönetimi (listele, kaydet, sil)                          */
/* ------------------------------------------------------------------ */

/**
 * KAPSAM KURALI (tek cümlede): global kural PLATFORMUNDUR, şirket kuralı
 * ŞİRKETİNDİR.
 *
 * · admin: global kuralları GÖRÜR (okutmasını onlar belirliyor) ama
 *   değiştiremez; kendi şirketinin kurallarını ekler, düzenler, siler.
 *   Aynı öneki kendi kapsamında tanımlayarak globali fiilen ezer -
 *   `kurallariSirala` öncelik eşitliğinde şirket kuralını öne alır.
 * · super_admin: globali de düzenler.
 *
 * Yazma sonrası ÖNBELLEK TEMİZLENİR, yoksa değişiklik 60 saniye boyunca
 * okutma ekranına yansımaz ve yönetici "kural çalışmıyor" diye geri gelir.
 */

export type KuralKapsami = "global" | "sirket";

export interface KuralSatiri {
  id: string;
  barkodOneki: string;
  kaynak: string;
  kargoFirmasi: string;
  oncelik: number;
  aktif: boolean;
  aciklama: string | null;
  kapsam: KuralKapsami;
  /** Bu kullanıcı bu satırı düzenleyip silebilir mi. */
  duzenlenebilir: boolean;
}

/** Aynı kapsamda aynı önek iki kez tanımlanamaz (kısmi tekil indeks). */
export class KuralCakismasi extends Error {
  constructor(readonly onek: string) {
    super(`"${onek}" öneki bu kapsamda zaten tanımlı.`);
    this.name = "KuralCakismasi";
  }
}

/** Kural yok ya da bu kullanıcının kapsamında değil (ikisi AYNI cevabı verir). */
export class KuralYok extends Error {
  constructor() {
    super("Kural bulunamadı.");
    this.name = "KuralYok";
  }
}

export class KuralYetkisi extends Error {
  constructor(mesaj = "Genel kuralları yalnız platform yöneticisi değiştirebilir.") {
    super(mesaj);
    this.name = "KuralYetkisi";
  }
}

function tekillikIhlaliMi(hata: unknown): boolean {
  let h: unknown = hata;
  for (let i = 0; i < 5 && h; i += 1) {
    const o = h as { code?: unknown; cause?: unknown };
    if (o.code === "23505") return true;
    h = o.cause;
  }
  return false;
}

/**
 * Yönetim ekranının listesi: global + şirket kuralları, EŞLEŞME SIRASINDA.
 *
 * Sıralama sorgudadır ve `lib/barkod/coz.ts`'teki `kurallariSirala` ile
 * birebir aynıdır (öncelik artan → uzun önek önce → şirket kuralı globalden
 * önce). Liste "hangi kural önce denenir" sorusunun cevabı olduğu için
 * alfabetik sıralamak kullanıcıyı yanıltırdı.
 */
export async function listele(k: Kapsam): Promise<KuralSatiri[]> {
  const superMi = k.rol === "super_admin";

  const satirlar = await db
    .select()
    .from(barkodKurallari)
    .where(
      or(
        isNull(barkodKurallari.sirketId),
        eq(barkodKurallari.sirketId, k.sirketId),
      ),
    )
    .orderBy(
      asc(barkodKurallari.oncelik),
      sql`length(${barkodKurallari.barkodOneki}) desc`,
      sql`(${barkodKurallari.sirketId} is null) asc`,
      asc(barkodKurallari.barkodOneki),
    );

  return satirlar.map((s) => {
    const kapsam: KuralKapsami = s.sirketId ? "sirket" : "global";
    return {
      id: s.id,
      barkodOneki: s.barkodOneki,
      kaynak: s.kaynak,
      kargoFirmasi: s.kargoFirmasi,
      oncelik: s.oncelik,
      aktif: s.aktif,
      aciklama: s.aciklama,
      kapsam,
      duzenlenebilir: kapsam === "sirket" || superMi,
    };
  });
}

export interface KuralGirdisi {
  /** Verilirse güncelleme, verilmezse ekleme. */
  id?: string;
  barkodOneki: string;
  kaynak: string;
  kargoFirmasi: string;
  oncelik: number;
  aktif: boolean;
  aciklama?: string | null;
  /** Platform varsayılanı olarak yaz (yalnız super_admin). */
  global?: boolean;
}

/** Yazma sonrası önbellek: global değişiklik HER şirketi etkiler. */
function onbellegiTazele(k: Kapsam, globalMi: boolean): void {
  if (globalMi) kuralOnbelleginiTemizle();
  else kuralOnbelleginiTemizle(k.sirketId);
}

/** Var olan kuralı bu kapsamda bulur; yoksa ya da yetki yoksa hata. */
async function duzenlenebilirKural(
  k: Kapsam,
  id: string,
): Promise<{ id: string; sirketId: string | null }> {
  const [satir] = await db
    .select({ id: barkodKurallari.id, sirketId: barkodKurallari.sirketId })
    .from(barkodKurallari)
    .where(
      and(
        eq(barkodKurallari.id, id),
        or(
          isNull(barkodKurallari.sirketId),
          eq(barkodKurallari.sirketId, k.sirketId),
        ),
      ),
    )
    .limit(1);

  if (!satir) throw new KuralYok();
  if (satir.sirketId === null && k.rol !== "super_admin") {
    throw new KuralYetkisi();
  }
  return satir;
}

/**
 * Kural ekler ya da günceller.
 *
 * ÖNEK BÜYÜK HARFE ÇEVRİLİR: eşleşme `kuralEslestir` içinde
 * `barkodTemizle` ile büyük harf üzerinden yapılır; "ptt" diye kaydedilen
 * bir kural hiçbir barkodla eşleşmez ve kullanıcı sebebini bulamazdı.
 */
export async function kaydet(k: Kapsam, girdi: KuralGirdisi): Promise<string> {
  const globalMi = girdi.global === true;
  if (globalMi && k.rol !== "super_admin") throw new KuralYetkisi();

  const onek = girdi.barkodOneki.trim().toUpperCase();
  const degerler = {
    barkodOneki: onek,
    kaynak: girdi.kaynak.trim(),
    kargoFirmasi: girdi.kargoFirmasi.trim(),
    oncelik: Math.round(girdi.oncelik),
    aktif: girdi.aktif,
    aciklama: girdi.aciklama?.trim() || null,
    // Yönetici kuralı HER ZAMAN kendi şirketine yazılır; istemciden gelen
    // bir şirket kimliği bu dosyaya hiç girmez.
    sirketId: globalMi ? null : k.sirketId,
  };

  try {
    if (girdi.id) {
      const mevcut = await duzenlenebilirKural(k, girdi.id);
      const [guncel] = await db
        .update(barkodKurallari)
        .set({ ...degerler, updatedAt: new Date() })
        .where(eq(barkodKurallari.id, mevcut.id))
        .returning({ id: barkodKurallari.id });
      if (!guncel) throw new KuralYok();
      // Kapsam değiştiyse (global → şirket ya da tersi) iki önbellek de bayat.
      onbellegiTazele(k, globalMi || mevcut.sirketId === null);
      return guncel.id;
    }

    const [yeni] = await db
      .insert(barkodKurallari)
      .values(degerler)
      .returning({ id: barkodKurallari.id });
    if (!yeni) throw new KuralYok();
    onbellegiTazele(k, globalMi);
    return yeni.id;
  } catch (hata) {
    if (tekillikIhlaliMi(hata)) throw new KuralCakismasi(onek);
    throw hata;
  }
}

/** Yalnız aktiflik anahtarını çevirir (listedeki hızlı geçiş). */
export async function aktiflikDegistir(
  k: Kapsam,
  id: string,
  aktif: boolean,
): Promise<void> {
  const mevcut = await duzenlenebilirKural(k, id);
  await db
    .update(barkodKurallari)
    .set({ aktif, updatedAt: new Date() })
    .where(eq(barkodKurallari.id, mevcut.id));
  onbellegiTazele(k, mevcut.sirketId === null);
}

/** Kuralı siler. Global kuralı yalnız super_admin silebilir. */
export async function sil(k: Kapsam, id: string): Promise<void> {
  const mevcut = await duzenlenebilirKural(k, id);
  await db.delete(barkodKurallari).where(eq(barkodKurallari.id, mevcut.id));
  onbellegiTazele(k, mevcut.sirketId === null);
}
