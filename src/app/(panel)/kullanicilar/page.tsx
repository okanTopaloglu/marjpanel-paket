import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { listele } from "@/lib/db/repos/kullanicilar";
import { listeleSayimlarla } from "@/lib/db/repos/sirketler";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { KullaniciEkleTetikleyici } from "./kullanici-formu";
import { KullaniciListesi } from "./kullanici-listesi";
import { OkutmaModuAyari } from "./okutma-modu-ayari";

export default async function KullanicilarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sirket?: string }>;
}) {
  const kapsam = await adminKapsamiZorunlu();
  const { sirket } = await searchParams;
  const superMi = kapsam.rol === "super_admin";

  const [kullaniciListesi, sirketSecenekleriTam] = await Promise.all([
    listele(kapsam, superMi ? { sirketId: sirket || undefined } : undefined),
    superMi ? listeleSayimlarla() : Promise.resolve([]),
  ]);
  const sirketSecenekleri = sirketSecenekleriTam.map((s) => ({ id: s.id, ad: s.ad }));

  return (
    <>
      <SayfaBasligi
        baslik="Kullanıcılar"
        aciklama={
          superMi
            ? "Platformdaki tüm çalışan ve yönetici hesapları."
            : "Şirketinizdeki çalışan ve yönetici hesapları."
        }
        aksiyonlar={
          <KullaniciEkleTetikleyici
            superMi={superMi}
            kendiId={kapsam.kullaniciId}
            sirketSecenekleri={sirketSecenekleri}
          />
        }
      />

      {!superMi && (
        <div className="mb-5">
          <OkutmaModuAyari mevcutMod={kapsam.sirket.varsayilanOkutmaModu} />
        </div>
      )}

      <KullaniciListesi
        satirlar={kullaniciListesi}
        kendiId={kapsam.kullaniciId}
        superMi={superMi}
        sirketSecenekleri={sirketSecenekleri}
        seciliSirketId={sirket ?? ""}
      />
    </>
  );
}
