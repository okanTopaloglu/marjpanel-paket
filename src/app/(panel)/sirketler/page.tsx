import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { superKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function SirketlerSayfasi() {
  const kapsam = await superKapsami();
  if (!kapsam) redirect("/");

  return (
    <>
      <SayfaBasligi
        baslik="Şirketler"
        aciklama="Platformdaki tüm şirketler ve durumları."
      />
      <BosDurum
        ikon={Building2}
        baslik="Şirket listesi yakında"
        aciklama="Platforma kayıtlı tüm şirketler burada listelenecek."
      />
    </>
  );
}
