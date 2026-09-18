/**
 * İdempotent seed: `pnpm db:seed`. Tekrar çalıştırıldığında mevcut kayıtları
 * bozmaz (onConflictDoNothing / varlık kontrolü).
 *
 * Tohumlar:
 *  - Platform varsayılanı barkod kuralları (sirket_id = NULL)
 *  - İlk şirket (SEED_SIRKET_AD) ve süper yönetici (SEED_ADMIN_TELEFON/PAROLA/AD)
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { eq, isNull, and } from "drizzle-orm";
import { db, client } from "./client";
import { barkodKurallari, kullanicilar, sirketler } from "./schema";
import { VARSAYILAN_KURALLAR } from "@/lib/barkod/varsayilan-kurallar";
import { telefonNormalize } from "@/lib/format/telefon";

async function kurallariTohumla() {
  let eklenen = 0;
  for (const k of VARSAYILAN_KURALLAR) {
    const mevcut = await db
      .select({ id: barkodKurallari.id })
      .from(barkodKurallari)
      .where(
        and(isNull(barkodKurallari.sirketId), eq(barkodKurallari.barkodOneki, k.barkodOneki)),
      )
      .limit(1);
    if (mevcut.length) continue;
    await db.insert(barkodKurallari).values({
      sirketId: null,
      barkodOneki: k.barkodOneki,
      kaynak: k.kaynak,
      kargoFirmasi: k.kargoFirmasi,
      oncelik: k.oncelik,
      aciklama: k.aciklama ?? null,
    });
    eklenen++;
  }
  console.log(`Barkod kuralları: ${eklenen} eklendi, ${VARSAYILAN_KURALLAR.length - eklenen} zaten vardı.`);
}

async function ilkSirketVeYoneticiyiTohumla() {
  const sirketAd = process.env.SEED_SIRKET_AD?.trim();
  const telefonHam = process.env.SEED_ADMIN_TELEFON?.trim();
  const parola = process.env.SEED_ADMIN_PAROLA;
  const ad = process.env.SEED_ADMIN_AD?.trim() || "Yönetici";

  if (!sirketAd || !telefonHam || !parola) {
    console.log(
      "SEED_SIRKET_AD / SEED_ADMIN_TELEFON / SEED_ADMIN_PAROLA eksik; ilk yönetici tohumlanmadı.",
    );
    return;
  }
  const telefon = telefonNormalize(telefonHam);
  if (!telefon) {
    console.warn(`SEED_ADMIN_TELEFON geçersiz: ${telefonHam}`);
    return;
  }

  let sirket = (
    await db.select().from(sirketler).where(eq(sirketler.ad, sirketAd)).limit(1)
  )[0];
  if (!sirket) {
    sirket = (await db.insert(sirketler).values({ ad: sirketAd, azamiEntegrasyon: null }).returning())[0]!;
    console.log(`Şirket oluşturuldu: ${sirketAd}`);
  }

  const varMi = await db
    .select({ id: kullanicilar.id })
    .from(kullanicilar)
    .where(eq(kullanicilar.telefon, telefon))
    .limit(1);
  if (varMi.length) {
    console.log("Süper yönetici zaten var; parola değiştirilmedi.");
    return;
  }
  await db.insert(kullanicilar).values({
    sirketId: sirket.id,
    telefon,
    parolaHash: await hash(parola),
    ad,
    rol: "super_admin",
  });
  console.log(`Süper yönetici oluşturuldu: ${telefon}`);
}

async function main() {
  await kurallariTohumla();
  await ilkSirketVeYoneticiyiTohumla();
  console.log("Seed tamamlandı.");
}

main()
  .catch((err) => {
    console.error("Seed hatası:", err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
