"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, useTransition } from "react";
import { Camera, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMasaustu } from "@/lib/hooks/medya";
import { useSes } from "@/lib/hooks/ses";
import { useTarayiciOdak } from "@/lib/hooks/tarayici-odak";
import { perdeIcerigi, sonucTonu, type OkutmaSonucu } from "@/lib/okut/sonuc";
import type { OkutmaKalemi } from "@/lib/okut/sonuc";
import type { BugunOzeti, PaketSatiri } from "@/lib/db/repos/paketler";
import type {
  BekleyenSayilari,
  EntegrasyonSecenegi,
} from "@/lib/db/repos/okut-siparis";
import type { OkutmaModu } from "@/lib/db/schema";
import { paketOkut } from "@/server/actions/okut";
import { EntegrasyonSec, MANUEL } from "./entegrasyon-sec";
import { HizliMod } from "./hizli-mod";
import { LiderTablosu } from "./lider-tablosu";
import { RehberliIcerik } from "./rehberli-icerik";
import { SonOkutmalar } from "./son-okutmalar";
import { ToplamaModu } from "./toplama/toplama-modu";
import { UyariPerdesi } from "./uyari-perdesi";
import { AZAMI_SATIR, sonucSatiri, sunucuSatiri } from "./tipler";

/**
 * OKUTMA EKRANI - üç modun ortak kabuğu.
 *
 * `hizli` ve `rehberli` aynı ekrandır; tek fark rehberlide son okutulan
 * siparişin içeriğinin de gösterilmesidir. `toplama` bambaşka bir akıştır
 * (atama sistemi) ve kendi bileşenine devredilir.
 *
 * AKIŞ HİÇ DURMAZ: barkod alanı pasifleşmez, istek beklenirken yeni okutma
 * kabul edilir (`bekleyen` sayacı yalnız bilgi verir), sonuç geldiğinde satır
 * listeye düşer. Kullanıcının durması gereken durumlarda (mükerrer, iptal,
 * kargolanmış) tam ekran perde açılır ve ses çalar.
 */

/** Kamera yalnız istendiğinde ve yalnız tarayıcıda yüklenir (~100 KB). */
const KameraOkuyucu = dynamic(() => import("./kamera-okuyucu"), {
  ssr: false,
});

export function OkutEkrani({
  mod,
  entegrasyonlar,
  baslangicSatirlar,
  baslangicBugun,
  baslangicBekleyen,
}: {
  mod: OkutmaModu;
  entegrasyonlar: EntegrasyonSecenegi[];
  baslangicSatirlar: PaketSatiri[];
  baslangicBugun: BugunOzeti;
  baslangicBekleyen: BekleyenSayilari;
}) {
  const ses = useSes();

  if (mod === "toplama") {
    return <ToplamaModu ses={ses} />;
  }

  return (
    <HizliEkran
      mod={mod}
      ses={ses}
      entegrasyonlar={entegrasyonlar}
      baslangicSatirlar={baslangicSatirlar}
      baslangicBugun={baslangicBugun}
      baslangicBekleyen={baslangicBekleyen}
    />
  );
}

function HizliEkran({
  mod,
  ses,
  entegrasyonlar,
  baslangicSatirlar,
  baslangicBugun,
  baslangicBekleyen,
}: {
  mod: OkutmaModu;
  ses: ReturnType<typeof useSes>;
  entegrasyonlar: EntegrasyonSecenegi[];
  baslangicSatirlar: PaketSatiri[];
  baslangicBugun: BugunOzeti;
  baslangicBekleyen: BekleyenSayilari;
}) {
  const [deger, setDeger] = useState("");
  const [satirlar, setSatirlar] = useState(() =>
    baslangicSatirlar.map(sunucuSatiri),
  );
  const [perde, setPerde] = useState<OkutmaSonucu | null>(null);
  const [rehberli, setRehberli] = useState<{
    siparisNo: string | null;
    kalemler: OkutmaKalemi[];
  } | null>(null);
  const [entegrasyon, setEntegrasyon] = useState(MANUEL);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState(0);
  const [kameraAcik, setKameraAcik] = useState(false);
  const [kameraSayaci, setKameraSayaci] = useState(0);
  const [, gecisBaslat] = useTransition();

  const girisRef = useRef<HTMLInputElement | null>(null);
  const sayac = useRef(0);
  const masaustu = useMasaustu();

  // Kamera açıkken odak hırsızlığı YAPILMAZ: video yüzeyi kendi işini görür.
  useTarayiciOdak(girisRef, { etkin: !kameraAcik });

  const okut = useCallback(
    (barkod: string) => {
      setHata(null);
      setBekleyen((n) => n + 1);

      gecisBaslat(async () => {
        try {
          const cevap = await paketOkut(barkod, entegrasyon || undefined);
          if (!cevap.ok) {
            ses.cal("hata");
            setHata(cevap.hata);
            return;
          }

          const sonuc = cevap.sonuc;
          sayac.current += 1;
          setSatirlar((onceki) =>
            [sonucSatiri(sonuc, `s-${sayac.current}`), ...onceki].slice(
              0,
              AZAMI_SATIR,
            ),
          );
          ses.cal(sonucTonu(sonuc));
          if (perdeIcerigi(sonuc)) setPerde(sonuc);
          if (sonuc.sonuc === "kaydedildi") {
            setKameraSayaci((n) => n + 1);
            if (mod === "rehberli" && sonuc.rehberli) {
              setRehberli(sonuc.rehberli);
            }
          }
        } catch {
          ses.cal("hata");
          setHata("Paket kaydedilemedi. Bağlantınızı kontrol edip tekrar okutun.");
        } finally {
          setBekleyen((n) => Math.max(0, n - 1));
        }
      });
    },
    [entegrasyon, mod, ses],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <EntegrasyonSec
          secenekler={entegrasyonlar}
          deger={entegrasyon}
          onDeger={setEntegrasyon}
        />

        <div data-odak-serbest className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={ses.degistir}
            aria-pressed={ses.kapali}
            title={ses.kapali ? "Sesi aç" : "Sesi kapat"}
          >
            {ses.kapali ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
            {ses.kapali ? "Ses kapalı" : "Ses açık"}
          </Button>
        </div>
      </div>

      {hata && (
        <p
          role="alert"
          className="rounded-[--radius-kontrol] border border-destructive/40 bg-destructive-soft px-3 py-2 text-footnote text-destructive"
        >
          {hata}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          <HizliMod
            deger={deger}
            onDeger={setDeger}
            onGonder={okut}
            girisRef={girisRef}
            bekleyen={bekleyen}
            yan={
              !masaustu ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-4"
                  onClick={() => {
                    setKameraSayaci(0);
                    setKameraAcik(true);
                  }}
                  aria-label="Kamera ile okut"
                >
                  <Camera className="h-5 w-5" aria-hidden="true" />
                </Button>
              ) : undefined
            }
          />

          {mod === "rehberli" && rehberli && (
            <RehberliIcerik
              kalemler={rehberli.kalemler}
              siparisNo={rehberli.siparisNo}
              baslik="Son okutulan siparişin içeriği"
            />
          )}

          <SonOkutmalar satirlar={satirlar} />
        </div>

        <LiderTablosu
          baslangicBugun={baslangicBugun}
          baslangicBekleyen={baslangicBekleyen}
          seciliEntegrasyon={entegrasyon}
        />
      </div>

      {kameraAcik && (
        <KameraOkuyucu
          onOkut={okut}
          okunanSayisi={kameraSayaci}
          onKapat={() => setKameraAcik(false)}
        />
      )}

      <UyariPerdesi sonuc={perde} onKapat={() => setPerde(null)} />
    </div>
  );
}
