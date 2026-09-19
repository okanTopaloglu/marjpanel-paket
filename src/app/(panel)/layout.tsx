import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { panelOturumu } from "@/lib/auth/yetki";
import { oturumOzeti } from "@/lib/auth/kapsam";
import { kiraciMarkasi, platformHostu } from "@/lib/kiraci/coz";
import { OturumSaglayici } from "@/components/panel/oturum-saglayici";
import { PanelKabuk } from "@/components/panel/panel-kabuk";
import { Topbar } from "@/components/panel/topbar";

/**
 * PANEL ARAMA MOTORLARINA KAPALI.
 *
 * Panel içeriği kişiye özeldir; dizine girmesinin ne kullanıcıya ne de bize
 * faydası var.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const o = await panelOturumu();
  if (!o) redirect("/giris");

  /*
   * ADRES KAPISI (kabuk): oturum çerezi host'a bağlıdır, yani bir kiracının
   * çerezi başka adreste zaten gönderilmez; bu kontrol alan adı SONRADAN
   * tanımlanan şirketin platform adresindeki eski oturumlarını doğru adrese
   * taşır. Süper yönetici her adreste gezebilir; yerelde kapalı.
   */
  if (process.env.NODE_ENV === "production" && o.kapsam.rol !== "super_admin") {
    const marka = await kiraciMarkasi();
    const alanAdi = o.kapsam.sirket.alanAdi;
    if (marka.tur === "kiraci" && marka.sirketId !== o.kapsam.sirketId) {
      redirect(alanAdi ? `https://${alanAdi}/` : `https://${platformHostu()}/`);
    }
    if (marka.tur === "platform" && alanAdi) redirect(`https://${alanAdi}/`);
  }

  const ozet = oturumOzeti(o.kapsam, o.profilGorsel);

  return (
    <OturumSaglayici ozet={ozet}>
      <PanelKabuk topbar={<Topbar ozet={ozet} />}>{children}</PanelKabuk>
    </OturumSaglayici>
  );
}
