import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { panelKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function PaketlerSayfasi() {
  const kapsam = await panelKapsami();
  if (!kapsam) redirect("/giris");

  return (
    <>
      <SayfaBasligi
        baslik="Paketler"
        aciklama="Okutulan tüm paketlerin listesi ve kargo durumu."
      />
      <BosDurum
        ikon={Package}
        baslik="Paket listesi yakında"
        aciklama="Okutulan paketler, arama ve filtrelerle burada listelenecek."
      />
    </>
  );
}
