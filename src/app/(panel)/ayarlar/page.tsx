import { redirect } from "next/navigation";
import { panelOturumu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { ProfilFormu } from "./profil-formu";
import { ProfilGorseli } from "./profil-gorseli";
import { SirketMarkasiKarti } from "./sirket-markasi";
import { adminMi } from "@/lib/auth/kapsam";

export default async function AyarlarSayfasi() {
  const oturum = await panelOturumu();
  if (!oturum) redirect("/giris");
  const { kapsam, profilGorsel } = oturum;

  return (
    <>
      <SayfaBasligi
        baslik="Ayarlar"
        aciklama="Hesap ve okutma tercihlerinizi buradan yönetin."
      />
      <div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
        <ProfilGorseli ad={kapsam.ad} profilGorsel={profilGorsel} />
        <ProfilFormu ad={kapsam.ad} telefon={kapsam.telefon} />
      </div>

      {adminMi(kapsam.rol) && (
        <div className="mt-5">
          <SirketMarkasiKarti
            sirketAd={kapsam.sirket.ad}
            markaAdi={kapsam.sirket.markaAdi}
            alanAdi={kapsam.sirket.alanAdi}
            logoAcik={kapsam.sirket.logoDosya ? `/g/${kapsam.sirket.logoDosya}` : null}
            logoKoyu={kapsam.sirket.logoKoyuDosya ? `/g/${kapsam.sirket.logoKoyuDosya}` : null}
          />
        </div>
      )}
    </>
  );
}
