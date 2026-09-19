import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { listeleSayimlarla } from "@/lib/db/repos/sirketler";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { SirketEkleTetikleyici } from "./sirket-formu";
import { SirketListesi } from "./sirket-listesi";

export default async function SirketlerSayfasi() {
  const kapsam = await superKapsamiZorunlu();
  const sirketler = await listeleSayimlarla();

  return (
    <>
      <SayfaBasligi
        baslik="Şirketler"
        aciklama="Platformdaki tüm şirketler ve durumları."
        aksiyonlar={<SirketEkleTetikleyici />}
      />
      <SirketListesi satirlar={sirketler} kendiSirketId={kapsam.sirketId} />
    </>
  );
}
