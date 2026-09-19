import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminKapsami } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import {
  entegrasyonAdlari,
  kargoAdlari,
  sayfa as siparisSayfasi,
  sekmeSayilari,
} from "@/lib/db/repos/siparisler";
import { sekmeMi, type Sekme } from "@/lib/siparis/durum";
import { SiparisListesi } from "./siparis-listesi";
import { EskiSil } from "./eski-sil";

export const metadata: Metadata = { title: "Siparişler" };

/** Liste her istekte tazedir: senkron dakikalar içinde satır ekler. */
export const dynamic = "force-dynamic";

/** Şimdilik tek pazaryeri; liste büyüdüğünde repodan okunacak. */
const PLATFORMLAR = ["trendyol"];

type Parametreler = {
  sekme?: string;
  platform?: string;
  arama?: string;
  kargo?: string;
  entegrasyon?: string;
  sayfa?: string;
};

/**
 * Siparişler sayfası.
 *
 * Filtrelerin TEK KAYNAĞI URL'dir (`searchParams`): sunucu burada okur,
 * istemci bileşeni yalnız yazar. Böylece paylaşılan bağlantı, yenileme ve geri
 * tuşu aynı listeyi gösterir; istemcide ikinci bir "filtre durumu" tutulmadığı
 * için de iki kaynak birbirinden ayrı düşemez.
 */
export default async function SiparislerSayfasi({
  searchParams,
}: {
  searchParams: Promise<Parametreler>;
}) {
  const kapsam = await adminKapsami();
  if (!kapsam) redirect("/");

  const p = await searchParams;
  const sekme: Sekme = sekmeMi(p.sekme) ? p.sekme : "tumu";
  const platform = p.platform?.trim() ?? "";
  const arama = p.arama?.trim() ?? "";
  const kargo = p.kargo?.trim() ?? "";
  const entegrasyon = p.entegrasyon?.trim() ?? "";
  const sayfaNo = Math.max(0, Number(p.sayfa ?? 0) || 0);

  const [sonuc, sayilar, kargolar, magazalar] = await Promise.all([
    siparisSayfasi(kapsam, {
      sekme,
      platform,
      arama,
      kargo,
      entegrasyon,
      sayfa: sayfaNo,
    }),
    sekmeSayilari(kapsam),
    kargoAdlari(kapsam),
    entegrasyonAdlari(kapsam),
  ]);

  return (
    <>
      <SayfaBasligi
        baslik="Siparişler"
        aciklama="Pazaryerlerinden gelen siparişlerin durumu, kargo bilgisi ve etiketleri."
      />

      <div className="space-y-6">
        <SiparisListesi
          sonuc={sonuc}
          sayilar={sayilar}
          kargolar={kargolar}
          entegrasyonlar={magazalar}
          platformlar={PLATFORMLAR}
          secili={{ sekme, platform, arama, kargo, entegrasyon }}
        />
        <EskiSil />
      </div>
    </>
  );
}
