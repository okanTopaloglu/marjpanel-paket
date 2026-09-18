import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function SiparislerSayfasi() {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  return (
    <>
      <SayfaBasligi
        baslik="Siparişler"
        aciklama="Pazaryeri siparişlerinin kargo ve paket durumu."
      />
      <BosDurum
        ikon={ShoppingCart}
        baslik="Sipariş listesi yakında"
        aciklama="Pazaryerlerinden gelen siparişler burada listelenecek."
      />
    </>
  );
}
