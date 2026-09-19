/**
 * M4 kullanıcı yönetimi repo'sunun DUMANLI TESTİ (manuel doğrulama betiği).
 * `pnpm exec tsx --env-file=.env scripts/dev/kullanici-deneme.ts` ile çalışır.
 *
 * Seed'deki super_admin için bir `Kapsam` üretir, geçici bir `calisan`
 * oluşturur, rolünü `admin`e yükseltir, kendi hesabını silmeyi dener (hata
 * beklenir) ve son olarak geçici kullanıcıyı temizler. Kalıcı veri
 * BIRAKMAZ.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { db, client } from "@/lib/db/client";
import { kullanicilar } from "@/lib/db/schema";
import {
  KullaniciIslemHatasi,
  guncelle,
  olustur,
  sil,
} from "@/lib/db/repos/kullanicilar";
import type { Kapsam } from "@/lib/auth/kapsam";

const SUPER_ADMIN_TELEFON = "5550000000";

let basarisiz = false;

function beklenen(kosul: boolean, aciklama: string) {
  console.log(kosul ? `  OK  ${aciklama}` : `  HATA  ${aciklama}`);
  if (!kosul) basarisiz = true;
}

async function main() {
  const [superAdmin] = await db
    .select()
    .from(kullanicilar)
    .where(eq(kullanicilar.telefon, SUPER_ADMIN_TELEFON))
    .limit(1);

  if (!superAdmin) {
    throw new Error(
      `Seed'deki super_admin bulunamadı (telefon ${SUPER_ADMIN_TELEFON}). Önce 'pnpm db:seed' çalıştırın.`,
    );
  }

  const kapsam: Kapsam = {
    kullaniciId: superAdmin.id,
    sirketId: superAdmin.sirketId,
    rol: superAdmin.rol,
    ad: superAdmin.ad,
    telefon: superAdmin.telefon,
    okutmaModu: superAdmin.okutmaModu,
    sirket: {
      ad: "",
      varsayilanOkutmaModu: "hizli",
      ozellikler: { faturaPaylas: false, faturaKesim: false, mail: false },
    },
  };
  console.log(`Kapsam: super_admin ${kapsam.telefon} / şirket ${kapsam.sirketId}`);

  const deneme = await olustur(kapsam, {
    ad: "Deneme Çalışan",
    telefon: "5559999999",
    parolaHash: await hash("deneme123"),
    rol: "calisan",
  });
  beklenen(deneme.rol === "calisan", "geçici kullanıcı 'calisan' rolüyle oluşturuldu");
  console.log(`  -> id ${deneme.id}`);

  try {
    const yukseltilmis = await guncelle(kapsam, deneme.id, { rol: "admin" });
    beklenen(yukseltilmis.rol === "admin", "rol 'admin'e yükseltildi");

    let kendiniSilmeReddedildi = false;
    try {
      await sil(kapsam, kapsam.kullaniciId);
    } catch (hata) {
      kendiniSilmeReddedildi =
        hata instanceof KullaniciIslemHatasi && hata.kod === "kendini-silemez";
      if (!kendiniSilmeReddedildi) throw hata;
    }
    beklenen(kendiniSilmeReddedildi, "kendi hesabını silme isteği reddedildi");

    // Seed şirketinde süper yönetici var; süper yönetici de yönetim yetkisi
    // taşıdığı için deneme kullanıcısı (admin) şirketin SON yöneticisi
    // değildir — silme kurala takılmaz. Kural `kullanici-kurallari.test.ts`te
    // saf olarak test edilir.
    await sil(kapsam, deneme.id);
    beklenen(true, "başka yönetici (super_admin) varken admin silinebildi");
  } finally {
    // Temizlik: sil() başarısız olduysa artık kalan satırı doğrudan kaldır.
    await db.delete(kullanicilar).where(eq(kullanicilar.id, deneme.id));
    const [kaldiMi] = await db
      .select({ id: kullanicilar.id })
      .from(kullanicilar)
      .where(eq(kullanicilar.id, deneme.id))
      .limit(1);
    beklenen(!kaldiMi, "geçici kullanıcı temizlendi");
  }
}

main()
  .catch((hata) => {
    console.error("Betik hatası:", hata);
    basarisiz = true;
  })
  .finally(async () => {
    await client.end();
    console.log(basarisiz ? "\nSONUÇ: BAŞARISIZ" : "\nSONUÇ: BAŞARILI");
    process.exitCode = basarisiz ? 1 : 0;
  });
