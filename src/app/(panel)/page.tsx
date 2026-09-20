import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { panelKapsamiZorunlu } from "@/lib/auth/yetki";
import { adminMi } from "@/lib/auth/kapsam";
import { kiraciMarkasi } from "@/lib/kiraci/coz";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import {
  aralikOzeti,
  gelismis,
  gunlukSeri,
  saatlikIsiHaritasi,
} from "@/lib/db/repos/istatistik";
import { aktifEntegrasyonVarMi } from "@/lib/db/repos/okut-siparis";
import { siparisAkisi } from "@/lib/db/repos/siparis-akisi";
import { SiparisAkisiKartlari } from "./siparis-akisi";
import { ON_AYAR_ETIKETLERI, aktifOnAyar, araligiCoz } from "@/lib/pano/aralik";
import { gunAnahtari, tarih } from "@/lib/format/tarih";
import { GunlukGrafik } from "./gunluk-grafik";
import { IsiHaritasi } from "./isi-haritasi";
import { PanoFiltre } from "./pano-filtre";
import { PanoIstatistik } from "./pano-istatistik";

export const metadata: Metadata = { title: "Özet" };

/**
 * ÖZET (PANO) - depo faaliyetinin günlük görünümü.
 *
 * VARSAYILAN ARALIK BUGÜNDÜR: pano vardiya başında açılır, "bugün kaç paket
 * çıktı" sorusu her şeyden önce gelir. Aralık URL'de (`?baslangic=&bitis=`)
 * tutulur; sayfa sunucuda çizilir, sorgular İstanbul günlerine göre gruplar.
 *
 * ÇALIŞAN GÖRÜNÜMÜ AYNI SAYFADIR, kırpılmış hâli: kısıt sorguda uygulanır
 * (repos/istatistik `Kapsam.rol`), burada yalnız bekleyen sipariş kartı
 * gizlenir - o sayı şirket geneline aittir ve çalışanın işini değiştirmez.
 *
 * `force-dynamic`: rakamlar dakikalar içinde değişir, önbelleklenmiş bir
 * kopya "sayaç durdu" gibi okunurdu.
 */
export const dynamic = "force-dynamic";

/** Gelişmiş özet ve ısı haritası penceresi (aralık filtresinden bağımsız). */
const PENCERE_GUN = 30;

/** Günlük seri penceresi. */
const SERI_GUN = 14;

/** Aralığın tek satırlık adı: ön ayar varsa adı, yoksa tarih aralığı. */
function aralikEtiketi(
  baslangic: string,
  bitis: string,
  bugun: string,
): string {
  const onAyar = aktifOnAyar({ baslangic, bitis }, bugun);
  if (onAyar) return ON_AYAR_ETIKETLERI[onAyar];
  if (baslangic === bitis) return tarih(baslangic);
  return `${tarih(baslangic)} - ${tarih(bitis)}`;
}

export default async function OzetSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ baslangic?: string; bitis?: string }>;
}) {
  const kapsam = await panelKapsamiZorunlu();

  /*
   * SÜPER YÖNETİCİ PLATFORM YÖNETİMİNE DÜŞER - ama yalnız PLATFORM
   * adresinde. Bir kiracının adresindeyse (sirket.marjpanel.com) orada
   * bilerek o şirketin panelini görmek istemiştir; oradan platforma zorla
   * atmak "şirketi görüntüle" akışını kırardı.
   */
  if (kapsam.rol === "super_admin") {
    const marka = await kiraciMarkasi();
    if (marka.tur === "platform") redirect("/platform");
  }

  const { baslangic: basHam, bitis: bitHam } = await searchParams;

  const bugun = gunAnahtari();
  const aralik = araligiCoz(basHam, bitHam, bugun);
  const yoneticiMi = adminMi(kapsam.rol);

  const [ozet, gelismisOzet, seri, isi, akis] = await Promise.all([
    aralikOzeti(kapsam, aralik.baslangic, aralik.bitis),
    gelismis(kapsam, PENCERE_GUN),
    gunlukSeri(kapsam, SERI_GUN),
    saatlikIsiHaritasi(kapsam, PENCERE_GUN),
    // Sipariş akışı YALNIZ yöneticiye ve yalnız pazaryeri bağlıysa: bağlantı
    // yokken "0 gelen" yazmak, çalışan bir şey olduğunu ima ederdi.
    yoneticiMi
      ? aktifEntegrasyonVarMi(kapsam.sirketId).then((var_) =>
          var_
            ? siparisAkisi(kapsam.sirketId, aralik.baslangic, aralik.bitis, kapsam.sirket.sevkKesimSaati)
            : null,
        )
      : Promise.resolve(null),
  ]);
  const etiket = aralikEtiketi(aralik.baslangic, aralik.bitis, bugun);

  return (
    <>
      <SayfaBasligi
        baslik="Özet"
        aciklama={
          yoneticiMi
            ? "Seçtiğiniz aralıkta kimin ne kadar okuttuğu, hangi pazaryerinden kaç paket çıktığı."
            : "Seçtiğiniz aralıkta kendi okutmalarınız."
        }
      />

      <div className="space-y-6">
        <PanoFiltre aralik={aralik} bugun={bugun} />

        {akis && <SiparisAkisiKartlari akis={akis} aralikEtiketi={etiket} />}

        <PanoIstatistik
          ozet={ozet}
          gelismisOzet={gelismisOzet}
          aralikEtiketi={etiket}
          gelismisGun={PENCERE_GUN}
          calisanMi={kapsam.rol === "calisan"}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <GunlukGrafik seri={seri} />
          <IsiHaritasi noktalar={isi} gun={PENCERE_GUN} />
        </div>
      </div>
    </>
  );
}
