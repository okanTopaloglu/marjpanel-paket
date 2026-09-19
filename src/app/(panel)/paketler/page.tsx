import { panelKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { filtreSecenekleri, sayfa as paketSayfasi } from "@/lib/db/repos/paketler";
import { SAYFA_LIMITI, filtreleriCoz } from "@/lib/paket/filtreler";
import { PaketListesi } from "./paket-listesi";

/**
 * PAKET LİSTESİ SAYFASI.
 *
 * Filtreler ADRES ÇUBUĞUNDA yaşar (bkz. `lib/paket/filtreler`): bağlantı
 * paylaşılabilir, geri tuşu çalışır, sunucu ilk boyamada doğru veriyi çeker.
 * Çözümleme saf fonksiyonda yapılır; elle kurcalanmış adres sayfayı
 * düşürmez, yalnız o filtreyi düşürür.
 *
 * `calisan` rolünde kullanıcı filtresi REPODA kendi kimliğine sabitlenir -
 * adrese başka bir kimlik yazmak işe yaramaz.
 */
export const dynamic = "force-dynamic";

export default async function PaketlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const kapsam = await panelKapsamiZorunlu();
  const { filtreler, sayfa } = filtreleriCoz(await searchParams);

  const [sonuc, secenekler] = await Promise.all([
    paketSayfasi(kapsam, filtreler, sayfa, SAYFA_LIMITI),
    filtreSecenekleri(kapsam),
  ]);

  return (
    <>
      <SayfaBasligi
        baslik="Paketler"
        aciklama="Okutulan paketlerin tamamı; barkod, kargo firması ve okutan kişiyle birlikte."
      />
      <PaketListesi
        sayfa={sonuc}
        filtreler={filtreler}
        secenekler={secenekler}
        calisanMi={kapsam.rol === "calisan"}
      />
    </>
  );
}
