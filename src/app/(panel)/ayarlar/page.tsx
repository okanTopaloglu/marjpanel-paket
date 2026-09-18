import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { panelKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function AyarlarSayfasi() {
  const kapsam = await panelKapsami();
  if (!kapsam) redirect("/giris");

  return (
    <>
      <SayfaBasligi
        baslik="Ayarlar"
        aciklama="Hesap ve okutma tercihlerinizi buradan yönetin."
      />
      <BosDurum
        ikon={Settings}
        baslik="Ayarlar yakında"
        aciklama="Okutma modu, bildirim ve hesap tercihleri burada açılacak."
      />
    </>
  );
}
