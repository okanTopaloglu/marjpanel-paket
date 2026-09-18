import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { kullanicilar, sirketler, type Sirket } from "@/lib/db/schema";

/**
 * ŞİRKET REPOSU — kiracı kaydı.
 *
 * Diğer CRUD (listele, güncelle, özellik bayrakları, silme) başka bir ajan
 * tarafından eklenecek; burada yalnız kayıt akışının ihtiyacı var.
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
