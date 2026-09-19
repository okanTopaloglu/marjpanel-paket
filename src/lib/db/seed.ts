/**
 * İdempotent seed: `pnpm db:seed`. Tekrar çalıştırıldığında mevcut kayıtları
 * bozmaz (onConflictDoNothing / varlık kontrolü).
 *
 * Tohumlar:
 *  - Platform varsayılanı barkod kuralları (sirket_id = NULL)
 *  - İlk şirket (SEED_SIRKET_AD) ve süper yönetici (SEED_ADMIN_TELEFON/PAROLA/AD)
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { hash } from "@node-rs/argon2";
import { dosyaKaydet } from "@/lib/depo/dosya";
import { alanAdiNormalize } from "@/lib/kiraci/kural";
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

/**
 * İlk şirketin kiracı kimliği — yalnız BOŞ alanlar doldurulur (panelden
 * yapılan değişiklik seed ile ezilmez):
 *  - SEED_SIRKET_ALAN_ADI   → giriş adresi (mamaaura.marjpanel.com)
 *  - SEED_SIRKET_MARKA_ADI  → görünen ad
 *  - SEED_SIRKET_LOGO / SEED_SIRKET_LOGO_KOYU → diskteki PNG'ler görsel
 *    deposuna kopyalanır (kod hiçbir şirketin logosunu bilmez).
 */
async function ilkSirketMarkasiniTohumla(sirketId: string) {
  const [s] = await db.select().from(sirketler).where(eq(sirketler.id, sirketId)).limit(1);
  if (!s) return;
  const set: Partial<typeof sirketler.$inferInsert> = {};

  const alanAdi = alanAdiNormalize(process.env.SEED_SIRKET_ALAN_ADI ?? "");
  if (!s.alanAdi && alanAdi) set.alanAdi = alanAdi;

  const markaAdi = process.env.SEED_SIRKET_MARKA_ADI?.trim();
  if (!s.markaAdi && markaAdi) set.markaAdi = markaAdi;

  const logoYukle = async (yol: string | undefined): Promise<string | null> => {
    if (!yol?.trim()) return null;
    try {
      const uzanti = extname(yol).slice(1);
      return await dosyaKaydet(await readFile(yol.trim()), uzanti);
    } catch (hata) {
      console.warn(`Seed logo yüklenemedi (${yol}): ${hata instanceof Error ? hata.message : String(hata)}`);
      return null;
    }
  };
  if (!s.logoDosya) {
    const d = await logoYukle(process.env.SEED_SIRKET_LOGO);
    if (d) set.logoDosya = d;
  }
  if (!s.logoKoyuDosya) {
    const d = await logoYukle(process.env.SEED_SIRKET_LOGO_KOYU);
    if (d) set.logoKoyuDosya = d;
  }

  if (Object.keys(set).length) {
    await db.update(sirketler).set({ ...set, updatedAt: new Date() }).where(eq(sirketler.id, sirketId));
    console.log(`Şirket markası tohumlandı: ${Object.keys(set).join(", ")}`);
  }
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
  await ilkSirketMarkasiniTohumla(sirket.id);

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
