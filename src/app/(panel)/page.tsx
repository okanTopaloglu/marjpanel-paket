import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { panelKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function OzetSayfasi() {
  const kapsam = await panelKapsami();
  if (!kapsam) redirect("/giris");

  return (
    <>
      <SayfaBasligi
        baslik="Özet"
        aciklama="Depo faaliyetinin günlük görünümü burada olacak."
      />
      <BosDurum
        ikon={LayoutDashboard}
        baslik="Özet yakında"
        aciklama="Bugün okutulan paket sayısı, bekleyen işler ve kargo durumu burada görünecek."
      />
    </>
  );
}
