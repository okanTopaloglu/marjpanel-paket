import { redirect } from "next/navigation";
import { Box } from "lucide-react";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

export default async function UrunlerSayfasi() {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  return (
    <>
      <SayfaBasligi baslik="Ürünler" aciklama="Barkod eşleşen ürün kataloğu." />
      <BosDurum
        ikon={Box}
        baslik="Ürün kataloğu yakında"
        aciklama="Ürünler ve barkod eşleşmeleri burada listelenecek."
      />
    </>
  );
}
