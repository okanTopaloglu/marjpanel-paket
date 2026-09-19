import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { aralikOku, listele } from "@/lib/db/repos/entegrasyonlar";
import { EntegrasyonListesi } from "./entegrasyon-listesi";
import { EntegrasyonEkleKarti } from "./entegrasyon-formu";
import { AralikAyari } from "./aralik-ayari";
import { SenkronDurumu } from "./senkron-durumu";

export const metadata: Metadata = { title: "Entegrasyonlar" };

/**
 * Entegrasyonlar sayfası — pazaryeri bağlantıları ve senkron ayarı.
 *
 * `force-dynamic`: sayfa oturuma ve şirkete bağlı veri gösterir; senkron
 * zamanları da dakikalar içinde değişir, statik kopya yanıltıcı olurdu.
 */
export const dynamic = "force-dynamic";

export default async function EntegrasyonlarSayfasi() {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  const [kayitlar, aralik] = await Promise.all([
    listele(kapsam.sirketId),
    aralikOku(kapsam.sirketId),
  ]);

  return (
    <>
      <SayfaBasligi
        baslik="Entegrasyonlar"
        aciklama="Pazaryeri mağazalarınızı bağlayın; siparişler otomatik olarak buraya akar."
        aksiyonlar={<EntegrasyonEkleKarti />}
      />

      <div className="space-y-6">
        <SenkronDurumu />
        <EntegrasyonListesi kayitlar={kayitlar} />
        <AralikAyari mevcut={aralik} />
      </div>
    </>
  );
}
