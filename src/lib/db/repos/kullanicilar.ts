import { and, desc, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  kullanicilar,
  sirketler,
  type Kullanici,
  type KullaniciRolu,
  type OkutmaModu,
} from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";
import { CakismaHatasi } from "@/lib/db/repos/sirketler";
import { KullaniciIslemHatasi, sonAdminKorumasiIhlaliMi } from "@/lib/db/repos/kullanici-kurallari";

export { KullaniciIslemHatasi, sonAdminKorumasiIhlaliMi } from "@/lib/db/repos/kullanici-kurallari";
export type { KullaniciHataKodu } from "@/lib/db/repos/kullanici-kurallari";

/**
 * KULLANICI REPOSU.
 *
 * Üstteki blok giriş akışının ve kapsam üretiminin ihtiyaç duyduğu
 * fonksiyonlardır (dokunulmadı). Alttaki blok M4 kullanıcı yönetimi CRUD'u:
 * listele / oluştur / güncelle / sil / profil işlemleri. Her fonksiyon
 * `sirketId`'yi (doğrudan ya da `Kapsam` üzerinden) açık parametre olarak
 * alır — kiracı izolasyonu burada da kaynağını korur.
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

/* ==================================================================== */
/* KULLANICI YÖNETİMİ CRUD'U (M4)                                       */
/* ==================================================================== */

/** Kısıt adı → alan eşlemesi (yalnız bu tablonun tekillik kısıtı). */
function telefonCakismasiMi(hata: unknown): boolean {
  let h: unknown = hata;
  for (let i = 0; i < 5 && h; i++) {
    const o = h as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (o.code === "23505" && o.constraint_name === "kullanicilar_telefon_unique") {
      return true;
    }
    h = o.cause;
  }
  return false;
}

/** Aynı şirkette, `haric` dışında, kaç aktif admin var. */
async function digerAktifAdminSayisi(sirketId: string, haric: string): Promise<number> {
  const [satir] = await db
    .select({ adet: sql<number>`count(*)::int` })
    .from(kullanicilar)
    .where(
      and(
        eq(kullanicilar.sirketId, sirketId),
        eq(kullanicilar.rol, "admin"),
        eq(kullanicilar.aktif, true),
        ne(kullanicilar.id, haric),
      ),
    );
  return satir?.adet ?? 0;
}

export interface KullaniciListeSatiri {
  id: string;
  ad: string;
  telefon: string;
  rol: KullaniciRolu;
  okutmaModu: OkutmaModu | null;
  aktif: boolean;
  profilGorsel: string | null;
  sirketAd: string;
  createdAt: Date;
}

/**
 * Kullanıcı listesi. admin: yalnız kendi şirketi. super_admin: tüm şirketler,
 * ya da `opts.sirketId` verildiyse tek şirket (kullanıcılar sayfasındaki
 * "Şirket" filtresi).
 */
export async function listele(
  k: Kapsam,
  opts?: { sirketId?: string },
): Promise<KullaniciListeSatiri[]> {
  const kosul =
    k.rol === "super_admin"
      ? opts?.sirketId
        ? eq(kullanicilar.sirketId, opts.sirketId)
        : undefined
      : eq(kullanicilar.sirketId, k.sirketId);

  return db
    .select({
      id: kullanicilar.id,
      ad: kullanicilar.ad,
      telefon: kullanicilar.telefon,
      rol: kullanicilar.rol,
      okutmaModu: kullanicilar.okutmaModu,
      aktif: kullanicilar.aktif,
      profilGorsel: kullanicilar.profilGorsel,
      sirketAd: sirketler.ad,
      createdAt: kullanicilar.createdAt,
    })
    .from(kullanicilar)
    .innerJoin(sirketler, eq(sirketler.id, kullanicilar.sirketId))
    .where(kosul)
    .orderBy(desc(kullanicilar.createdAt));
}

/**
 * Kullanıcı oluşturma. super_admin `sirketId` seçebilir (verilmezse kendi
 * şirketi); admin HER ZAMAN kendi şirketine ekler (istemciden gelen farklı
 * bir `sirketId` sessizce yok sayılır — güven istemciden alınmaz).
 * `super_admin` rolü yalnız zaten `super_admin` olan bir kapsam tarafından
 * atanabilir.
 */
export async function olustur(
  k: Kapsam,
  girdi: {
    ad: string;
    telefon: string;
    parolaHash: string;
    rol: KullaniciRolu;
    okutmaModu?: OkutmaModu | null;
    sirketId?: string;
  },
): Promise<Kullanici> {
  if (girdi.rol === "super_admin" && k.rol !== "super_admin") {
    throw new KullaniciIslemHatasi("yetkisiz-rol", "Bu rolü atama yetkiniz yok.");
  }
  const hedefSirketId = k.rol === "super_admin" ? (girdi.sirketId ?? k.sirketId) : k.sirketId;

  try {
    const [satir] = await db
      .insert(kullanicilar)
      .values({
        sirketId: hedefSirketId,
        telefon: girdi.telefon,
        parolaHash: girdi.parolaHash,
        ad: girdi.ad,
        rol: girdi.rol,
        okutmaModu: girdi.okutmaModu ?? null,
      })
      .returning();
    if (!satir) throw new Error("Kullanıcı oluşturulamadı.");
    return satir;
  } catch (hata) {
    if (telefonCakismasiMi(hata)) throw new CakismaHatasi("telefon");
    throw hata;
  }
}

/**
 * Kullanıcı güncelleme. Kapsam dışı şirketin kullanıcısına (admin için)
 * dokunulamaz; kendi rolünü değiştiremez; şirketin son aktif admin'i rolden
 * düşürülüp pasifleştirilemez; `super_admin` rolü yalnız `super_admin`
 * tarafından atanabilir.
 */
export async function guncelle(
  k: Kapsam,
  id: string,
  girdi: {
    ad?: string;
    telefon?: string;
    rol?: KullaniciRolu;
    okutmaModu?: OkutmaModu | null;
    aktif?: boolean;
    parolaHash?: string;
  },
): Promise<Kullanici> {
  const hedef = await idIleGetir(id);
  if (!hedef) throw new KullaniciIslemHatasi("bulunamadi", "Kullanıcı bulunamadı.");
  if (k.rol !== "super_admin" && hedef.sirketId !== k.sirketId) {
    throw new KullaniciIslemHatasi("yetkisiz", "Bu kullanıcıyı düzenleme yetkiniz yok.");
  }
  if (id === k.kullaniciId && girdi.rol !== undefined && girdi.rol !== hedef.rol) {
    throw new KullaniciIslemHatasi("kendi-rolu", "Kendi rolünüzü değiştiremezsiniz.");
  }
  if (girdi.rol === "super_admin" && k.rol !== "super_admin") {
    throw new KullaniciIslemHatasi("yetkisiz-rol", "Bu rolü atama yetkiniz yok.");
  }

  const hedefAktifAdminMi = hedef.rol === "admin" && hedef.aktif;
  if (hedefAktifAdminMi && (girdi.rol !== undefined || girdi.aktif !== undefined)) {
    const digerSayi = await digerAktifAdminSayisi(hedef.sirketId, id);
    if (
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: digerSayi,
        yeniRol: girdi.rol,
        yeniAktif: girdi.aktif,
      })
    ) {
      throw new KullaniciIslemHatasi(
        "son-admin",
        "Şirketin son aktif yöneticisi rolden düşürülemez ya da pasifleştirilemez.",
      );
    }
  }

  const set: Partial<typeof kullanicilar.$inferInsert> = { updatedAt: new Date() };
  if (girdi.ad !== undefined) set.ad = girdi.ad;
  if (girdi.telefon !== undefined) set.telefon = girdi.telefon;
  if (girdi.rol !== undefined) set.rol = girdi.rol;
  if (girdi.okutmaModu !== undefined) set.okutmaModu = girdi.okutmaModu;
  if (girdi.aktif !== undefined) set.aktif = girdi.aktif;
  if (girdi.parolaHash !== undefined) set.parolaHash = girdi.parolaHash;

  try {
    const [satir] = await db
      .update(kullanicilar)
      .set(set)
      .where(eq(kullanicilar.id, id))
      .returning();
    if (!satir) throw new KullaniciIslemHatasi("bulunamadi", "Kullanıcı bulunamadı.");
    return satir;
  } catch (hata) {
    if (hata instanceof KullaniciIslemHatasi) throw hata;
    if (telefonCakismasiMi(hata)) throw new CakismaHatasi("telefon");
    throw hata;
  }
}

/** Kullanıcı silme. Kendi hesabını silemez; şirketin son aktif admin'i silinemez. */
export async function sil(k: Kapsam, id: string): Promise<void> {
  if (id === k.kullaniciId) {
    throw new KullaniciIslemHatasi("kendini-silemez", "Kendi hesabınızı silemezsiniz.");
  }
  const hedef = await idIleGetir(id);
  if (!hedef) throw new KullaniciIslemHatasi("bulunamadi", "Kullanıcı bulunamadı.");
  if (k.rol !== "super_admin" && hedef.sirketId !== k.sirketId) {
    throw new KullaniciIslemHatasi("yetkisiz", "Bu kullanıcıyı silme yetkiniz yok.");
  }

  const hedefAktifAdminMi = hedef.rol === "admin" && hedef.aktif;
  if (hedefAktifAdminMi) {
    const digerSayi = await digerAktifAdminSayisi(hedef.sirketId, id);
    if (
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: digerSayi,
        yeniAktif: false,
      })
    ) {
      throw new KullaniciIslemHatasi("son-admin", "Şirketin son aktif yöneticisi silinemez.");
    }
  }

  await db.delete(kullanicilar).where(eq(kullanicilar.id, id));
}

/** Kendi profilini güncelleme (ad ve/veya parola) — herhangi bir girişli kullanıcı. */
export async function profilGuncelle(
  kullaniciId: string,
  girdi: { ad?: string; parolaHash?: string },
): Promise<void> {
  const set: Partial<typeof kullanicilar.$inferInsert> = { updatedAt: new Date() };
  if (girdi.ad !== undefined) set.ad = girdi.ad;
  if (girdi.parolaHash !== undefined) set.parolaHash = girdi.parolaHash;
  if (girdi.ad === undefined && girdi.parolaHash === undefined) return;
  await db.update(kullanicilar).set(set).where(eq(kullanicilar.id, kullaniciId));
}

/**
 * Profil görselini ayarlar (ya da `null` ile kaldırır); ESKİ dosya adını
 * döner ki çağıran diskten silsin (`lib/depo/dosya.ts`'nin `dosyaSil`'i).
 */
export async function profilGorseliAyarla(
  kullaniciId: string,
  dosyaAdi: string | null,
): Promise<string | null> {
  const [mevcut] = await db
    .select({ profilGorsel: kullanicilar.profilGorsel })
    .from(kullanicilar)
    .where(eq(kullanicilar.id, kullaniciId))
    .limit(1);
  await db
    .update(kullanicilar)
    .set({ profilGorsel: dosyaAdi, updatedAt: new Date() })
    .where(eq(kullanicilar.id, kullaniciId));
  return mevcut?.profilGorsel ?? null;
}

/** Şirketin varsayılan okutma modunu değiştirir (admin/super_admin, kendi şirketi). */
export async function sirketOkutmaModu(k: Kapsam, mod: OkutmaModu): Promise<void> {
  await db
    .update(sirketler)
    .set({ varsayilanOkutmaModu: mod, updatedAt: new Date() })
    .where(eq(sirketler.id, k.sirketId));
}
