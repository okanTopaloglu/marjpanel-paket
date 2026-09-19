import { panelKapsamiZorunlu } from "@/lib/auth/yetki";
import { etkinOkutmaModu } from "@/lib/auth/kapsam";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { bugunOzet, sonOkutmalar } from "@/lib/db/repos/paketler";
import {
  bekleyenSayilari,
  entegrasyonSecenekleri,
} from "@/lib/db/repos/okut-siparis";
import { OkutEkrani } from "./okut-ekrani";

/**
 * PAKET OKUT SAYFASI.
 *
 * Ekranın AÇILIŞ verisi burada, tek turda çekilir (mağaza listesi, son
 * okutmalar, bugünün sayıları, bekleyen sipariş sayısı): depo terminali
 * sayfayı açtığı anda dolu görsün, sonra istemci yalnız değişeni yoklasın.
 *
 * Mod kararı SUNUCUDA verilir (`etkinOkutmaModu`): kullanıcı ayarı > şirket
 * varsayılanı. İstemciye yalnız sonuç iner, kural değil.
 */
export const dynamic = "force-dynamic";

const ACIKLAMALAR = {
  hizli: "Kargo barkodunu okutun, paket anında kaydedilsin.",
  rehberli: "Barkodu okutun, siparişin içeriği ekranda görünsün.",
  toplama: "Size atanan paketleri toplayıp tek tek paketleyin.",
} as const;

export default async function OkutSayfasi() {
  const kapsam = await panelKapsamiZorunlu();
  const mod = etkinOkutmaModu(kapsam);

  const [entegrasyonlar, satirlar, bugun, bekleyen] = await Promise.all([
    entegrasyonSecenekleri(kapsam.sirketId),
    sonOkutmalar(kapsam, 20),
    bugunOzet(kapsam.sirketId),
    bekleyenSayilari(kapsam.sirketId),
  ]);

  return (
    <>
      <SayfaBasligi baslik="Paket Okut" aciklama={ACIKLAMALAR[mod]} />
      <OkutEkrani
        mod={mod}
        entegrasyonlar={entegrasyonlar}
        baslangicSatirlar={satirlar}
        baslangicBugun={bugun}
        baslangicBekleyen={bekleyen}
      />
    </>
  );
}
