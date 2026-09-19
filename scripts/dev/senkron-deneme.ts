/**
 * SENKRON BORU HATTI DENEMESİ (yalnız geliştirme).
 *
 * Amacı senkronun BAŞTAN SONA çalıştığını kanıtlamaktır: sahte bir entegrasyon
 * açar, `tik()`i bir kez çalıştırır, `senkron_isleri` satırını basar ve
 * temizler. Anahtarlar sahte olduğu için Trendyol kimlik/ağ hatası dönmesi
 * BEKLENEN sonuçtur - hata mesajının işe yazılmış olması zincirin (zamanlayıcı
 * → iş kuyruğu → istemci → hata yakalama → iş kapatma) çalıştığını gösterir.
 *
 * Çalıştırma:
 *   pnpm exec tsx --env-file=.env scripts/dev/senkron-deneme.ts
 */
import { and, desc, eq } from "drizzle-orm";
import { db, client } from "../../src/lib/db/client";
import { entegrasyonlar, senkronIsleri, sirketler } from "../../src/lib/db/schema";
import { kimlikSifrele } from "../../src/lib/pazaryeri/kimlik";
import { tik } from "../../src/lib/senkron/zamanlayici";

const SAHTE_SATICI = "999999999";

async function main(): Promise<void> {
  const [sirket] = await db.select().from(sirketler).orderBy(sirketler.createdAt).limit(1);
  if (!sirket) {
    console.error("Şirket bulunamadı. Önce `pnpm db:seed` çalıştırın.");
    process.exitCode = 1;
    return;
  }
  console.log(`Şirket: ${sirket.ad} (${sirket.id})`);

  // Var olan sahte kayıt kaldıysa temizle (önceki yarım kalan koşu).
  await db
    .delete(entegrasyonlar)
    .where(
      and(
        eq(entegrasyonlar.sirketId, sirket.id),
        eq(entegrasyonlar.saticiId, SAHTE_SATICI),
      ),
    );

  const [sahte] = await db
    .insert(entegrasyonlar)
    .values({
      sirketId: sirket.id,
      platform: "trendyol",
      ad: "Deneme mağazası",
      saticiId: SAHTE_SATICI,
      kimlikSifreli: kimlikSifrele({
        saticiId: SAHTE_SATICI,
        apiKey: "deneme-api-anahtari",
        apiSecret: "deneme-gizli-anahtar",
      }),
    })
    .returning();
  if (!sahte) throw new Error("Sahte entegrasyon eklenemedi.");
  console.log(`Sahte entegrasyon eklendi: ${sahte.id}`);

  console.log("tik() çalıştırılıyor...");
  await tik();

  const [is] = await db
    .select()
    .from(senkronIsleri)
    .orderBy(desc(senkronIsleri.createdAt))
    .limit(1);

  if (!is) {
    console.error("Senkron işi oluşmadı - boru hattı çalışmadı.");
    process.exitCode = 1;
  } else {
    console.log("--- senkron_isleri son satır ---");
    console.log(
      JSON.stringify(
        {
          id: is.id,
          tur: is.tur,
          tetik: is.tetik,
          durum: is.durum,
          baslangic: is.baslangic,
          bitis: is.bitis,
          mesaj: is.mesaj,
          hatalar: is.hatalar,
          ilerleme: is.ilerleme,
        },
        null,
        2,
      ),
    );
    if (is.durum === "hata") {
      console.log(
        "\nBeklenen sonuç: sahte anahtarla Trendyol kimlik/ağ hatası. Boru hattı çalışıyor.",
      );
    }
  }

  // Temizlik: sahte entegrasyon ve bu koşuda açılan iş satırları.
  await db
    .delete(entegrasyonlar)
    .where(eq(entegrasyonlar.id, sahte.id));
  if (is) await db.delete(senkronIsleri).where(eq(senkronIsleri.id, is.id));
  console.log("Sahte kayıtlar silindi.");
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
