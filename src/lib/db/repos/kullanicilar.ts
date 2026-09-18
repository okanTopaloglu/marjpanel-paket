import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { kullanicilar, sirketler, type Kullanici } from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";

/**
 * KULLANICI REPOSU — KİMLİK DOĞRULAMA YÜZEYİ.
 *
 * Bu dosyada YALNIZ giriş akışının ve kapsam üretiminin ihtiyaç duyduğu
 * fonksiyonlar vardır. Kullanıcı yönetimi CRUD'u (listele, ekle, güncelle,
 * pasifleştir, parola sıfırla) BAŞKA BİR AJAN tarafından buraya eklenecek;
 * dosya sonundaki nota bakınız.
 */

/** Giriş kimliği telefondur; kanonik biçimde (5XXXXXXXXX) aranır. */
export async function telefonlaGetir(telefon: string): Promise<Kullanici | null> {
  const [satir] = await db
    .select()
    .from(kullanicilar)
    .where(eq(kullanicilar.telefon, telefon))
    .limit(1);
  return satir ?? null;
}

export async function idIleGetir(id: string): Promise<Kullanici | null> {
  const [satir] = await db
    .select()
    .from(kullanicilar)
    .where(eq(kullanicilar.id, id))
    .limit(1);
  return satir ?? null;
}

/** Ardışık hatalı deneme eşiği ve kilit süresi. */
export const KILIT_ESIGI = 5;
export const KILIT_DK = 15;

/**
 * Sabitler kodda tanımlı sayılardır; `sql.raw` ile gömülür çünkü postgres.js
 * şablonuna bind edilen sayı/interval parametreleri tip hatası veriyor.
 */
const ESIK = sql.raw(String(KILIT_ESIGI));
const KILIT_ARALIGI = sql.raw(`interval '${KILIT_DK} minutes'`);

/**
 * Hatalı giriş: sayacı ATOMİK artırır; eşiğe ulaşınca 15 dk kilitler ve sayacı
 * sıfırlar. Tek UPDATE (CASE) olduğu için eşzamanlı denemelerde de doğrudur —
 * önce oku sonra yaz deseni olsaydı iki paralel deneme aynı sayacı ezerdi.
 */
export async function girisBasarisiz(id: string): Promise<void> {
  await db
    .update(kullanicilar)
    .set({
      hataliDeneme: sql`CASE WHEN ${kullanicilar.hataliDeneme} + 1 >= ${ESIK} THEN 0 ELSE ${kullanicilar.hataliDeneme} + 1 END`,
      kilitBitis: sql`CASE WHEN ${kullanicilar.hataliDeneme} + 1 >= ${ESIK} THEN now() + ${KILIT_ARALIGI} ELSE ${kullanicilar.kilitBitis} END`,
      updatedAt: new Date(),
    })
    .where(eq(kullanicilar.id, id));
}

/** Başarılı giriş: sayaç + kilidi temizler (zaten temizse hiç yazmaz). */
export async function girisBasarili(id: string): Promise<void> {
  await db
    .update(kullanicilar)
    .set({ hataliDeneme: 0, kilitBitis: null, updatedAt: new Date() })
    .where(
      and(
        eq(kullanicilar.id, id),
        or(
          sql`${kullanicilar.hataliDeneme} > 0`,
          isNotNull(kullanicilar.kilitBitis),
        ),
      ),
    );
}

export interface KapsamSatiri {
  kapsam: Kapsam;
  /** Kabuğun profil görselini çizmesi için; `Kapsam`'ın parçası değildir. */
  profilGorsel: string | null;
  /** Pasifleştirilen kullanıcı elindeki jetonla panelde kalmasın. */
  aktif: boolean;
}

/**
 * KAPSAM ÜRETİMİ — her istekte TAZE. Kullanıcı + şirket tek sorguda okunur;
 * rol, aktiflik ve şirket özellikleri JWT'den DEĞİL buradan gelir. Rolü
 * düşürülen ya da pasifleştirilen kullanıcı bir sonraki istekte düşer.
 */
export async function kapsamIcinGetir(
  kullaniciId: string,
): Promise<KapsamSatiri | null> {
  const [satir] = await db
    .select({
      id: kullanicilar.id,
      sirketId: kullanicilar.sirketId,
      rol: kullanicilar.rol,
      ad: kullanicilar.ad,
      telefon: kullanicilar.telefon,
      okutmaModu: kullanicilar.okutmaModu,
      profilGorsel: kullanicilar.profilGorsel,
      aktif: kullanicilar.aktif,
      sirketAd: sirketler.ad,
      varsayilanOkutmaModu: sirketler.varsayilanOkutmaModu,
      faturaPaylas: sirketler.faturaPaylasAcik,
      faturaKesim: sirketler.faturaKesimAcik,
      mail: sirketler.mailAcik,
    })
    .from(kullanicilar)
    .innerJoin(sirketler, eq(sirketler.id, kullanicilar.sirketId))
    .where(eq(kullanicilar.id, kullaniciId))
    .limit(1);

  if (!satir) return null;

  return {
    aktif: satir.aktif,
    profilGorsel: satir.profilGorsel,
    kapsam: {
      kullaniciId: satir.id,
      sirketId: satir.sirketId,
      rol: satir.rol,
      ad: satir.ad,
      telefon: satir.telefon,
      okutmaModu: satir.okutmaModu,
      sirket: {
        ad: satir.sirketAd,
        varsayilanOkutmaModu: satir.varsayilanOkutmaModu,
        ozellikler: {
          faturaPaylas: satir.faturaPaylas,
          faturaKesim: satir.faturaKesim,
          mail: satir.mail,
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* NOT: Kullanıcı yönetimi CRUD'u (listele / olustur / guncelle /      */
/* pasiflestir / parolaDegistir) buraya SONRADAN eklenecek. Kapsamın   */
/* üretimi ve giriş akışı bu dosyada kalır; eklenecek fonksiyonlar     */
/* `sirketId`'yi her zaman açık parametre olarak almalıdır.            */
/* ------------------------------------------------------------------ */
