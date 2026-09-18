import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function KullanicilarSayfasi() {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  return (
    <>
      <SayfaBasligi
        baslik="Kullanıcılar"
        aciklama="Şirketinizdeki çalışan ve yönetici hesapları."
      />
      <BosDurum
        ikon={Users}
        baslik="Kullanıcı listesi yakında"
        aciklama="Çalışan ve yönetici hesapları burada eklenip yönetilecek."
      />
    </>
  );
}
