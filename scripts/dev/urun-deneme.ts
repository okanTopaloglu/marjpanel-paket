/**
 * ÜRÜN + KURAL + İSTATİSTİK DENEMESİ (yalnız geliştirme).
 *
 * M4-B'nin veri katmanını uçtan uca kanıtlar:
 *   1. Seed'deki super_admin için gerçek bir `Kapsam` üretir.
 *   2. Tek ürün upsert'i (`kaydet`).
 *   3. Toplu upsert (`topluKaydet`) - BOŞ ALANIN mevcut değeri EZMEDİĞİNİ
 *      doğrular (Excel içe aktarımının en kritik davranışı).
 *   4. Arama + sayım.
 *   5. Şirkete özel barkod kuralı yazar, `barkodCoz` önbellek temizliğinden
 *      sonra yeni kuralı görüyor mu diye bakar.
 *   6. Bugünün `aralikOzeti` özetini basar.
 * Sonunda açtığı her satırı siler.
 *
 * Çalıştırma:
 *   pnpm exec tsx --env-file=.env scripts/dev/urun-deneme.ts
 */
import { and, eq } from "drizzle-orm";
import { client, db } from "../../src/lib/db/client";
import {
  barkodKurallari,
  kullanicilar,
  paketOkutmalari,
  urunler,
} from "../../src/lib/db/schema";
import { kapsamIcinGetir } from "../../src/lib/db/repos/kullanicilar";
import {
  kaydet as urunKaydet,
  sayfa as urunSayfasi,
  sayim as urunSayimi,
  sil as urunSil,
  topluKaydet,
} from "../../src/lib/db/repos/urunler";
import {
  barkodCoz,
  kaydet as kuralKaydet,
  listele as kurallariListele,
  sil as kuralSil,
} from "../../src/lib/db/repos/barkod-kurallari";
import {
  aralikOzeti,
  gelismis,
  gunlukSeri,
  saatlikIsiHaritasi,
} from "../../src/lib/db/repos/istatistik";
import { gunAnahtari } from "../../src/lib/format/tarih";

const ONEK = "DENEME-M4-";
const BARKOD_1 = `${ONEK}0001`;
const BARKOD_2 = `${ONEK}0002`;
const BARKOD_3 = `${ONEK}0003`;
const KURAL_ONEKI = "ZZDENEME";
const OKUTMA_1 = `${ONEK}OKUTMA-1`;
const OKUTMA_2 = `${ONEK}OKUTMA-2`;

function esitMi(baslik: string, gercek: unknown, beklenen: unknown): void {
  const tamam = JSON.stringify(gercek) === JSON.stringify(beklenen);
  console.log(
    `${tamam ? "  ✓" : "  ✗"} ${baslik}: ${JSON.stringify(gercek)}${
      tamam ? "" : ` (beklenen ${JSON.stringify(beklenen)})`
    }`,
  );
  if (!tamam) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [yonetici] = await db
    .select({ id: kullanicilar.id })
    .from(kullanicilar)
    .where(eq(kullanicilar.rol, "super_admin"))
    .limit(1);
  if (!yonetici) {
    console.error("super_admin bulunamadı. Önce `pnpm db:seed` çalıştırın.");
    process.exitCode = 1;
    return;
  }

  const satir = await kapsamIcinGetir(yonetici.id);
  if (!satir) throw new Error("Kapsam üretilemedi.");
  const kapsam = satir.kapsam;
  console.log(
    `Kapsam: ${kapsam.ad} (${kapsam.rol}) / şirket ${kapsam.sirket.ad} (${kapsam.sirketId})\n`,
  );

  // Önceki yarım kalan koşudan artık varsa temizle.
  const temizle = async () => {
    for (const b of [BARKOD_1, BARKOD_2, BARKOD_3]) {
      await db
        .delete(urunler)
        .where(and(eq(urunler.sirketId, kapsam.sirketId), eq(urunler.barkod, b)));
    }
    await db
      .delete(barkodKurallari)
      .where(
        and(
          eq(barkodKurallari.sirketId, kapsam.sirketId),
          eq(barkodKurallari.barkodOneki, KURAL_ONEKI),
        ),
      );
    for (const b of [OKUTMA_1, OKUTMA_2]) {
      await db
        .delete(paketOkutmalari)
        .where(
          and(
            eq(paketOkutmalari.sirketId, kapsam.sirketId),
            eq(paketOkutmalari.barkod, b),
          ),
        );
    }
  };
  await temizle();

  try {
    /* 1) Tek ürün ---------------------------------------------------- */
    console.log("1) kaydet - tek ürün");
    await urunKaydet(kapsam, {
      barkod: BARKOD_1,
      urunAdi: "Deneme Ürünü",
      gorselUrl: "https://ornek/1.jpg",
      marka: "MarjDeneme",
      kategori: "Test",
      stokKodu: "STK-1",
    });
    const [ilk] = await urunSayfasi(kapsam, { arama: BARKOD_1 });
    esitMi("ürün adı", ilk?.urunAdi, "Deneme Ürünü");
    esitMi("marka", ilk?.marka, "MarjDeneme");

    // Boş alan NULL yazılmalı ("" değil): arayüz "-" gösterebilsin.
    await urunKaydet(kapsam, { barkod: BARKOD_3, urunAdi: "Yalnız ad" });
    const [bos] = await urunSayfasi(kapsam, { arama: BARKOD_3 });
    esitMi("boş marka NULL", bos?.marka, null);
    esitMi("boş görsel NULL", bos?.gorselUrl, null);

    /* 2) Toplu upsert - boş alan ezmemeli ---------------------------- */
    console.log("\n2) topluKaydet - boş alan mevcut değeri EZMEMELİ");
    const yazilan = await topluKaydet(kapsam, [
      // Aynı barkod: yalnız ürün adı gelir, marka/görsel BOŞ - eski değerler
      // korunmalı.
      { barkod: BARKOD_1, urunAdi: "Deneme Ürünü (güncel)", marka: "", gorselUrl: "" },
      { barkod: BARKOD_2, urunAdi: "İkinci Ürün", marka: "MarjDeneme" },
      { barkod: BARKOD_3, urunAdi: "Üçüncü Ürün" },
    ]);
    esitMi("yazılan satır", yazilan, 3);

    const [guncel] = await urunSayfasi(kapsam, { arama: BARKOD_1 });
    esitMi("ad güncellendi", guncel?.urunAdi, "Deneme Ürünü (güncel)");
    esitMi("marka KORUNDU", guncel?.marka, "MarjDeneme");
    esitMi("görsel KORUNDU", guncel?.gorselUrl, "https://ornek/1.jpg");
    esitMi("stok kodu KORUNDU", guncel?.stokKodu, "STK-1");

    /* 3) Arama ve sayım ---------------------------------------------- */
    console.log("\n3) sayfa + sayim");
    const arananlar = await urunSayfasi(kapsam, { arama: ONEK });
    esitMi("arama sonucu", arananlar.length, 3);
    const sayi = await urunSayimi(kapsam, ONEK);
    esitMi("sayım", sayi, 3);
    console.log(`  toplam katalog: ${await urunSayimi(kapsam)} ürün`);

    /* 4) Barkod kuralı + çözüm --------------------------------------- */
    console.log("\n4) kural kaydet + barkodCoz (önbellek temizliğiyle)");
    // Önbelleği ısıt: kural yazılmadan ÖNCE çözüm bilinmeyen olmalı.
    const oncesi = await barkodCoz(kapsam.sirketId, `${KURAL_ONEKI}12345`);
    esitMi("kural öncesi kaynak", oncesi.kaynak, "Bilinmiyor");

    const kuralId = await kuralKaydet(kapsam, {
      barkodOneki: KURAL_ONEKI,
      kaynak: "Deneme Pazaryeri",
      kargoFirmasi: "Deneme Kargo",
      oncelik: 5,
      aktif: true,
      aciklama: "Geliştirme denemesi.",
    });
    const sonrasi = await barkodCoz(kapsam.sirketId, `${KURAL_ONEKI}12345`);
    esitMi("kural sonrası kaynak", sonrasi.kaynak, "Deneme Pazaryeri");
    esitMi("kural sonrası kargo", sonrasi.kargoFirmasi, "Deneme Kargo");

    const kurallar = await kurallariListele(kapsam);
    const bizimki = kurallar.find((k) => k.id === kuralId);
    esitMi("kapsam", bizimki?.kapsam, "sirket");
    esitMi("düzenlenebilir", bizimki?.duzenlenebilir, true);
    console.log(
      `  listede ${kurallar.length} kural (${kurallar.filter((k) => k.kapsam === "global").length} genel)`,
    );
    console.log(
      `  ilk üç sıra: ${kurallar
        .slice(0, 3)
        .map((k) => `${k.barkodOneki}(${k.oncelik})`)
        .join(", ")}`,
    );

    /* 5) İstatistikler ------------------------------------------------ */
    // Pano sorgularının BOŞ veriyle de dolu veriyle de koştuğunu görmek için
    // iki geçici okutma satırı yazılır (sonunda silinir).
    console.log("\n5) istatistik - iki geçici okutma satırıyla");
    await db.insert(paketOkutmalari).values([
      {
        sirketId: kapsam.sirketId,
        kullaniciId: kapsam.kullaniciId,
        barkod: OKUTMA_1,
        okutanAd: kapsam.ad,
        kaynak: "Deneme Pazaryeri",
        kargoFirmasi: "Deneme Kargo",
      },
      {
        sirketId: kapsam.sirketId,
        kullaniciId: kapsam.kullaniciId,
        barkod: OKUTMA_2,
        okutanAd: kapsam.ad,
        // Kaynağı boş satır: `coalesce(nullif(...))` onu "Bilinmiyor" saymalı.
        kaynak: null,
        kargoFirmasi: null,
      },
    ]);

    const bugun = gunAnahtari();
    const ozet = await aralikOzeti(kapsam, bugun, bugun);
    esitMi("bugünkü toplam (en az 2)", ozet.toplam >= 2, true);
    esitMi(
      "boş kaynak Bilinmiyor sayıldı",
      ozet.kaynakBazinda.some((s) => s.etiket === "Bilinmiyor"),
      true,
    );
    console.log(`  toplam okutma: ${ozet.toplam}`);
    console.log(
      `  çalışan: ${ozet.calisanBazinda.map((c) => `${c.ad}=${c.adet}`).join(", ") || "-"}`,
    );
    console.log(
      `  kaynak: ${ozet.kaynakBazinda.map((s) => `${s.etiket}=${s.adet}`).join(", ") || "-"}`,
    );
    console.log(
      `  kargo: ${ozet.kargoBazinda.map((s) => `${s.etiket}=${s.adet}`).join(", ") || "-"}`,
    );

    const seri = await gunlukSeri(kapsam, 14);
    esitMi("günlük seri uzunluğu", seri.length, 14);
    esitMi("serinin son günü bugün", seri[seri.length - 1]?.gun, bugun);
    esitMi("bugün seride en az 2", (seri[seri.length - 1]?.adet ?? 0) >= 2, true);

    const isi = await saatlikIsiHaritasi(kapsam, 30);
    esitMi("ısı haritası dolu", isi.length > 0, true);
    console.log(
      `  ısı haritası: ${isi.map((n) => `g${n.haftaGunu}s${n.saat}=${n.adet}`).join(", ")}`,
    );

    const ileri = await gelismis(kapsam, 30);
    console.log(
      `  gelişmiş: toplam=${ileri.toplam}, günlük ort=${ileri.gunlukOrtalama}, ` +
        `haftalık %${ileri.haftalikBuyumePct}, en iyi gün=${ileri.enIyiGun?.gun ?? "-"}`,
    );

    /* 6) Temizlik ----------------------------------------------------- */
    console.log("\n6) temizlik");
    let silinen = 0;
    for (const u of arananlar) silinen += await urunSil(kapsam, u.id);
    esitMi("silinen ürün", silinen, 3);
    await kuralSil(kapsam, kuralId);
    const kalan = await kurallariListele(kapsam);
    esitMi("kural silindi", kalan.some((k) => k.id === kuralId), false);
  } finally {
    await temizle();
    await client.end();
  }

  console.log(
    process.exitCode ? "\nBAZI KONTROLLER DÜŞTÜ." : "\nTüm kontroller geçti.",
  );
}

main().catch(async (hata) => {
  console.error(hata);
  process.exitCode = 1;
  await client.end();
});
