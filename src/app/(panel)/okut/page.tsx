import { redirect } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { panelKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function OkutSayfasi() {
  const kapsam = await panelKapsami();
  if (!kapsam) redirect("/giris");

  return (
    <>
      <SayfaBasligi
        baslik="Paket Okut"
        aciklama="Kargo barkodunu okutun, paket anında kaydedilsin."
      />
      <BosDurum
        ikon={ScanBarcode}
        baslik="Barkod okuma yakında"
        aciklama="Kamera ya da el terminaliyle barkod okutma burada açılacak."
      />
    </>
  );
}
