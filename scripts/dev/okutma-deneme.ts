/**
 * OKUTMA DUMAN TESTİ (yalnız geliştirme).
 *
 *   pnpm exec tsx --env-file=.env scripts/dev/okutma-deneme.ts
 *
 * Gerçek veritabanına karşı `okutmaKaydet` akışını uçtan uca dener:
 *   1. Trendyol öneki olan barkod  → kaydedildi (kaynak/kargo çözülür)
 *   2. Aynı barkod ikinci kez      → mukerrer (kim okuttu bilgisiyle)
 *   3. Hiçbir kurala uymayan barkod→ kaydedildi + uyari: bilinmeyen_kargo
 *
 * SONUNDA TEMİZLER: eklediği okutma satırlarını siler, dokunduğu siparişin
 * `hazir_zamani` damgasını eski hâline döndürür. Geliştirme veritabanı deneme
 * kalıntısıyla dolmasın.
 */
import { and, eq, inArray } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { kullanicilar, pazaryeriSiparisleri, paketOkutmalari } from "@/lib/db/schema";
import { kapsamIcinGetir } from "@/lib/db/repos/kullanicilar";
import { okutmaKaydet } from "@/lib/db/repos/paketler";
import { telefonNormalize } from "@/lib/format/telefon";

const TELEFON = "05550000000";
const TRENDYOL_BARKOD = "7331234567890";
const BILINMEYEN_BARKOD = "ZZZ999";
const BARKODLAR = [TRENDYOL_BARKOD, BILINMEYEN_BARKOD];

let hataSayisi = 0;

function dogrula(baslik: string, kosul: boolean, ek?: unknown): void {
  if (kosul) {
    console.log(`  ✓ ${baslik}`);
    return;
  }
  hataSayisi += 1;
  console.error(`  ✗ ${baslik}`, ek ?? "");
}

async function main(): Promise<void> {
  const telefon = telefonNormalize(TELEFON);
  if (!telefon) throw new Error(`Telefon çözümlenemedi: ${TELEFON}`);

  const [kullanici] = await db
    .select({ id: kullanicilar.id })
    .from(kullanicilar)
    .where(eq(kullanicilar.telefon, telefon))
    .limit(1);
  if (!kullanici) {
    throw new Error(
      `Seed kullanıcısı bulunamadı (${TELEFON}). Önce: pnpm db:seed`,
    );
  }

  const satir = await kapsamIcinGetir(kullanici.id);
  if (!satir) throw new Error("Kapsam üretilemedi.");
  const kapsam = satir.kapsam;
  console.log(
    `Kapsam: ${kapsam.ad} (${kapsam.rol}) / şirket ${kapsam.sirket.ad}\n`,
  );

  /* Denemeden ÖNCEKİ durum - temizlikte geri yüklenecek. */
  const oncekiSiparisler = await db
    .select({
      id: pazaryeriSiparisleri.id,
      hazirZamani: pazaryeriSiparisleri.hazirZamani,
    })
    .from(pazaryeriSiparisleri)
    .where(
      and(
        eq(pazaryeriSiparisleri.sirketId, kapsam.sirketId),
        inArray(pazaryeriSiparisleri.kargoTakipNo, BARKODLAR),
      ),
    );

  /* Önceki denemeden kalan satır varsa temizle (deneme tekrarlanabilsin). */
  await db
    .delete(paketOkutmalari)
    .where(
      and(
        eq(paketOkutmalari.sirketId, kapsam.sirketId),
        inArray(paketOkutmalari.barkod, BARKODLAR),
      ),
    );

  try {
    console.log("1) Trendyol barkodu ilk okutma");
    const ilk = await okutmaKaydet(kapsam, TRENDYOL_BARKOD);
    console.log("   ", JSON.stringify(ilk));
    dogrula("sonuc = kaydedildi", ilk.sonuc === "kaydedildi", ilk);
    if (ilk.sonuc === "kaydedildi") {
      dogrula("kaynak çözüldü", ilk.kaynak === "Trendyol", ilk.kaynak);
      dogrula(
        "kargo bilinmeyen uyarısı YOK",
        ilk.uyari !== "bilinmeyen_kargo",
        ilk.uyari,
      );
    }

    console.log("\n2) Aynı barkod ikinci okutma");
    const ikinci = await okutmaKaydet(kapsam, TRENDYOL_BARKOD);
    console.log("   ", JSON.stringify(ikinci));
    dogrula("sonuc = mukerrer", ikinci.sonuc === "mukerrer", ikinci);
    if (ikinci.sonuc === "mukerrer") {
      dogrula(
        "aynı kullanıcı işaretlendi",
        ikinci.mevcut.ayniKullanici === true,
        ikinci.mevcut,
      );
    }

    console.log("\n3) Kurala uymayan barkod");
    const ucuncu = await okutmaKaydet(kapsam, BILINMEYEN_BARKOD);
    console.log("   ", JSON.stringify(ucuncu));
    dogrula("sonuc = kaydedildi", ucuncu.sonuc === "kaydedildi", ucuncu);
    if (ucuncu.sonuc === "kaydedildi") {
      dogrula(
        "uyari = bilinmeyen_kargo",
        ucuncu.uyari === "bilinmeyen_kargo",
        ucuncu.uyari,
      );
    }
  } finally {
    /* TEMİZLİK */
    const silinen = await db
      .delete(paketOkutmalari)
      .where(
        and(
          eq(paketOkutmalari.sirketId, kapsam.sirketId),
          inArray(paketOkutmalari.barkod, BARKODLAR),
        ),
      )
      .returning({ id: paketOkutmalari.id });

    for (const s of oncekiSiparisler) {
      await db
        .update(pazaryeriSiparisleri)
        .set({ hazirZamani: s.hazirZamani })
        .where(
          and(
            eq(pazaryeriSiparisleri.sirketId, kapsam.sirketId),
            eq(pazaryeriSiparisleri.id, s.id),
          ),
        );
    }

    console.log(
      `\nTemizlik: ${silinen.length} okutma satırı silindi, ${oncekiSiparisler.length} sipariş damgası geri yüklendi.`,
    );
  }
}

main()
  .then(async () => {
    await client.end();
    if (hataSayisi > 0) {
      console.error(`\n${hataSayisi} beklenti karşılanmadı.`);
      process.exit(1);
    }
    console.log("\nTüm beklentiler karşılandı.");
  })
  .catch(async (hata) => {
    console.error(hata);
    await client.end().catch(() => {});
    process.exit(1);
  });
