import type { Metadata } from "next";
import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { SAYFA_LIMITI, sayfa as urunSayfasi, sayim } from "@/lib/db/repos/urunler";
import { listele as entegrasyonlariListele } from "@/lib/db/repos/entegrasyonlar";
import { durumOzeti } from "@/lib/db/repos/senkron-isleri";
import { ExcelAktar } from "./excel-aktar";
import { UrunEkleTetikleyici } from "./urun-formu";
import { UrunListesi } from "./urun-listesi";
import { UrunSenkron } from "./urun-senkron";

export const metadata: Metadata = { title: "Ürünler" };

/**
 * ÜRÜNLER - barkod → ad/görsel kataloğu.
 *
 * `force-dynamic`: liste oturuma ve arama parametresine bağlı, senkron da
 * arka planda yazıyor; statik kopya "değişikliğim kaydedilmedi" hissi verirdi.
 *
 * Arama ve sayfa URL'DEN okunur; filtreleme SORGUDA yapılır. Bütün katalogu
 * istemciye indirip orada süzmek 5000 ürünlük bir mağazada ilk boyamayı
 * saniyelere çıkarırdı.
 */
export const dynamic = "force-dynamic";

/** URL'deki sayfa 1 tabanlı görünür, sorgu 0 tabanlı çalışır. */
function sayfaNo(ham: string | undefined): number {
  const n = Number(ham);
  return Number.isInteger(n) && n > 1 ? n - 1 : 0;
}

export default async function UrunlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ arama?: string; sayfa?: string }>;
}) {
  const kapsam = await adminKapsamiZorunlu();
  const { arama: aramaHam, sayfa: sayfaHam } = await searchParams;

  const arama = (aramaHam ?? "").trim().slice(0, 120);
  const gecerliSayfa = sayfaNo(sayfaHam);

  const [satirlar, toplam, entegrasyonlar, senkronOzeti] = await Promise.all([
    urunSayfasi(kapsam, { arama, sayfa: gecerliSayfa, limit: SAYFA_LIMITI }),
    sayim(kapsam, arama),
    entegrasyonlariListele(kapsam.sirketId),
    durumOzeti(kapsam.sirketId),
  ]);

  return (
    <>
      <SayfaBasligi
        baslik="Ürünler"
        aciklama="Barkodun hangi ürüne ait olduğunu burası söyler; okutma ekranı ürün adını ve görselini buradan alır."
        aksiyonlar={<UrunEkleTetikleyici />}
      />

      <div className="space-y-6">
        {/* Katalogu besleyen iki yol alt alta: pazaryerinden çek, dosyadan
            aktar. Yan yana dizilseydi Excel önizleme tablosu yarım genişlikte
            sıkışırdı. */}
        <div className="space-y-4">
          <UrunSenkron
            entegrasyonlar={entegrasyonlar}
            baslangicOzeti={senkronOzeti}
          />
          <ExcelAktar />
        </div>

        <UrunListesi
          satirlar={satirlar}
          toplam={toplam}
          arama={arama}
          sayfa={gecerliSayfa}
          limit={SAYFA_LIMITI}
        />
      </div>
    </>
  );
}
