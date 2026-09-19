import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SirketLogoAlani } from "@/app/(panel)/sirketler/sirket-logo-alani";

/**
 * Ayarlar → Şirket markası (yalnız yönetici). Logo buradan yüklenir; giriş
 * adresi ve marka adı süper yöneticiye aittir, burada yalnız gösterilir.
 */
export function SirketMarkasiKarti({
  sirketAd,
  markaAdi,
  alanAdi,
  logoAcik,
  logoKoyu,
}: {
  sirketAd: string;
  markaAdi: string | null;
  alanAdi: string | null;
  logoAcik: string | null;
  logoKoyu: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Şirket markası</CardTitle>
        <CardDescription>
          Giriş ekranında, menüde ve üst çubukta {markaAdi?.trim() || sirketAd} olarak görünürsünüz
          {alanAdi ? (
            <>
              ; giriş adresiniz <span className="font-semibold text-foreground">https://{alanAdi}</span>
            </>
          ) : (
            <>; giriş adresi tanımlamak için MarjPanel yöneticinizle görüşün</>
          )}
          . Panel MarjPanel Paket altyapısıyla çalışır; altyapı notu her ekranda kalır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SirketLogoAlani logoAcik={logoAcik} logoKoyu={logoKoyu} />
      </CardContent>
    </Card>
  );
}
