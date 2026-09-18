import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { panelOturumu } from "@/lib/auth/yetki";
import { oturumOzeti } from "@/lib/auth/kapsam";
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

  const ozet = oturumOzeti(o.kapsam, o.profilGorsel);

  return (
    <OturumSaglayici ozet={ozet}>
      <PanelKabuk topbar={<Topbar ozet={ozet} />}>{children}</PanelKabuk>
    </OturumSaglayici>
  );
}
