import { redirect } from "next/navigation";
import { Plug } from "lucide-react";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function EntegrasyonlarSayfasi() {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  return (
    <>
      <SayfaBasligi
        baslik="Entegrasyonlar"
        aciklama="Pazaryeri ve kargo bağlantılarını buradan yönetin."
      />
      <BosDurum
        ikon={Plug}
        baslik="Entegrasyonlar yakında"
        aciklama="Pazaryeri ve kargo firması bağlantıları burada kurulacak."
      />
    </>
  );
}
