import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function BarkodKurallariSayfasi() {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  return (
    <>
      <SayfaBasligi
        baslik="Barkod Kuralları"
        aciklama="Barkod okutmada uygulanacak eşleme kuralları."
      />
      <BosDurum
        ikon={Truck}
        baslik="Barkod kuralları yakında"
        aciklama="Kargo barkodlarının nasıl okunacağını belirleyen kurallar burada tanımlanacak."
      />
    </>
  );
}
