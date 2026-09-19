import type { Metadata } from "next";
import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { listele } from "@/lib/db/repos/barkod-kurallari";
import { KuralEkleTetikleyici } from "./kural-formu";
import { KuralListesi } from "./kural-listesi";

export const metadata: Metadata = { title: "Barkod Kuralları" };

/**
 * BARKOD KURALLARI - okutmanın "bu paket kimin, hangi kargoyla" kararı.
 *
 * Liste global (platform varsayılanı) ve şirket kurallarını BİRLİKTE gösterir:
 * yönetici yalnız kendi kurallarını görseydi, okutmanın neden öyle
 * davrandığını açıklayan yarısı görünmez kalırdı. Global satırları yalnız
 * platform yöneticisi düzenleyebilir; şirket yöneticisi aynı öneki kendi
 * kapsamında tanımlayarak üzerine yazar.
 */
export const dynamic = "force-dynamic";

export default async function BarkodKurallariSayfasi() {
  const kapsam = await adminKapsamiZorunlu();
  const kurallar = await listele(kapsam);
  const superMi = kapsam.rol === "super_admin";

  return (
    <>
      <SayfaBasligi
        baslik="Barkod Kuralları"
        aciklama="Kargo barkodunun başındaki karakterlerden paketin pazaryerini ve kargo firmasını çıkarır."
        aksiyonlar={<KuralEkleTetikleyici superMi={superMi} />}
      />

      <KuralListesi kurallar={kurallar} superMi={superMi} />
    </>
  );
}
