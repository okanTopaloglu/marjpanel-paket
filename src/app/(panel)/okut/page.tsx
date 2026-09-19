import { redirect } from "next/navigation";
import { panelOturumu } from "@/lib/auth/yetki";
import { etkinOkutmaModu } from "@/lib/auth/kapsam";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { bugunOzet, sonOkutmalar } from "@/lib/db/repos/paketler";
import {
  bekleyenSayilari,
  entegrasyonSecenekleri,
} from "@/lib/db/repos/okut-siparis";
import { okutmaModuEnum, type OkutmaModu } from "@/lib/db/schema";
import { ModSec } from "./mod-sec";
import { OkutEkrani } from "./okut-ekrani";
import { SecimEkrani } from "./secim-ekrani";

/**
 * PAKET OKUT SAYFASI — üç adım, adım URL'DE.
 *
 *   /okut                      → mod seçimi (Hızlı / Rehberli / Toplama)
 *   /okut?mod=hizli            → mağaza seçimi (kargoya verilmesi gereken,
 *                                 entegrasyon listesi, bugünkü sıralama)
 *   /okut?mod=hizli&magaza=X   → okutma ekranı (X: mağaza adı ya da "manuel")
 *   /okut?mod=toplama          → toplama akışı (kendi kargo seçimi vardır)
 *
 * Adımın URL'de olması: geri tuşu bir adım geri gider, sayfa yenilenince
 * seçim kaybolmaz, terminal kısayolu doğrudan üçüncü adıma kurulabilir.
 *
 * Varsayılan mod (`etkinOkutmaModu`: kullanıcı ayarı > şirket varsayılanı)
 * ilk adımda ÖNERİLİ olarak işaretlenir; seçim yine kullanıcınındır.
 */
export const dynamic = "force-dynamic";

const ACIKLAMALAR: Record<OkutmaModu, string> = {
  hizli: "Kargo barkodunu okutun, paket anında kaydedilsin.",
  rehberli: "Barkodu okutun, siparişin içeriği ekranda görünsün.",
  toplama: "Size atanan paketleri toplayıp tek tek paketleyin.",
};

const MANUEL_MAGAZA = "manuel";

function modMu(v: string | undefined): v is OkutmaModu {
  return !!v && (okutmaModuEnum.enumValues as readonly string[]).includes(v);
}

export default async function OkutSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ mod?: string; magaza?: string }>;
}) {
  const oturum = await panelOturumu();
  if (!oturum) redirect("/giris");
  const { kapsam, profilGorsel } = oturum;
  const { mod: modHam, magaza } = await searchParams;
  const varsayilan = etkinOkutmaModu(kapsam);

  // 1) Mod seçimi
  if (!modMu(modHam)) {
    return (
      <>
        <SayfaBasligi baslik="Paket Okut" aciklama="Önce bugün nasıl çalışacağınızı seçin." />
        <ModSec varsayilan={varsayilan} />
      </>
    );
  }
  const mod = modHam;

  // Toplama: mağaza değil kargo firması seçilir; akış kendi içinde.
  if (mod === "toplama") {
    return (
      <>
        <SayfaBasligi baslik="Paket Okut" aciklama={ACIKLAMALAR.toplama} geri={{ href: "/okut", etiket: "Mod seçimi" }} />
        <OkutEkrani
          mod="toplama"
          entegrasyonlar={[]}
          baslangicSatirlar={[]}
          baslangicBugun={{ toplam: 0, kullanicilar: [] }}
          baslangicBekleyen={{ toplam: 0, entegrasyonBazinda: [] }}
          baslangicEntegrasyon=""
          geriHref="/okut"
        />
      </>
    );
  }

  const [entegrasyonlar, bugun, bekleyen] = await Promise.all([
    entegrasyonSecenekleri(kapsam.sirketId),
    bugunOzet(kapsam.sirketId),
    bekleyenSayilari(kapsam.sirketId),
  ]);

  // 2) Mağaza seçimi
  const seciliMagaza =
    magaza === MANUEL_MAGAZA
      ? ""
      : (entegrasyonlar.find((e) => e.ad.toLowerCase() === (magaza ?? "").toLowerCase())?.ad ?? null);

  if (seciliMagaza === null) {
    return (
      <>
        <SayfaBasligi baslik="Paket Okut" aciklama="Toplama yapacağınız mağazayı seçin; karışık okutmak için Manuel." geri={{ href: "/okut", etiket: "Mod seçimi" }} />
        <SecimEkrani
          mod={mod}
          kullanici={{ ad: kapsam.ad, telefon: kapsam.telefon, rol: kapsam.rol, profilGorsel, kullaniciId: kapsam.kullaniciId }}
          entegrasyonlar={entegrasyonlar}
          baslangicBugun={bugun}
          baslangicBekleyen={bekleyen}
        />
      </>
    );
  }

  // 3) Okutma
  const satirlar = await sonOkutmalar(kapsam, 20);
  const geriHref = `/okut?mod=${mod}`;
  return (
    <>
      <SayfaBasligi
        baslik="Paket Okut"
        aciklama={`${ACIKLAMALAR[mod]} Mağaza: ${seciliMagaza || "Manuel / Karışık"}.`}
        geri={{ href: geriHref, etiket: "Mağaza seçimi" }}
      />
      <OkutEkrani
        mod={mod}
        entegrasyonlar={entegrasyonlar}
        baslangicSatirlar={satirlar}
        baslangicBugun={bugun}
        baslangicBekleyen={bekleyen}
        baslangicEntegrasyon={seciliMagaza}
        geriHref={geriHref}
      />
    </>
  );
}
