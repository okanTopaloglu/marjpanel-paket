"use client";

import { useCallback, useEffect, useState } from "react";
import { Iskelet } from "@/components/panel/iskelet";
import type { useSes } from "@/lib/hooks/ses";
import type {
  AtananSiparis,
  KargoSecenegi,
} from "@/lib/db/repos/atama";
import type { ToplamaKalemi } from "@/lib/atama/secim";
import {
  atamalarimGetir,
  atamalariBirak,
  kargoFirmalariGetir,
  paketAta,
} from "@/server/actions/atama";
import { KargoSec } from "./kargo-sec";
import { Paketle } from "./paketle";
import { ToplamaListesi } from "./toplama-listesi";

/**
 * TOPLAMA MODU - üç adımlı akışın durum makinesi
 * (PartnerSys `useAssignment` + `ToplamaMode` portu).
 *
 *   kargo → liste → paketle
 *
 * AÇILIŞTA ÖNCE ATAMALAR SORULUR: çalışanın üstünde yarım kalmış paket varsa
 * ekran doğrudan toplama listesine düşer. Aksi halde bir kişi tarayıcıyı
 * kapatıp döndüğünde ikinci bir grup daha alır ve depoda iki grup birden
 * dolaşırdı.
 */

type Adim = "yukleniyor" | "kargo" | "liste" | "paketle";

export function ToplamaModu({ ses }: { ses: ReturnType<typeof useSes> }) {
  const [adim, setAdim] = useState<Adim>("yukleniyor");
  const [firmalar, setFirmalar] = useState<KargoSecenegi[]>([]);
  const [siparisler, setSiparisler] = useState<AtananSiparis[]>([]);
  const [liste, setListe] = useState<ToplamaKalemi[]>([]);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const firmalariYukle = useCallback(async () => {
    setCalisiyor(true);
    const cevap = await kargoFirmalariGetir();
    setCalisiyor(false);
    if (!cevap.ok) {
      setHata(cevap.hata);
      return;
    }
    setFirmalar(cevap.firmalar);
  }, []);

  const atamalariYukle = useCallback(async (): Promise<number> => {
    const cevap = await atamalarimGetir();
    if (!cevap.ok) {
      setHata(cevap.hata);
      return 0;
    }
    setSiparisler(cevap.liste.siparisler);
    setListe(cevap.liste.toplamaListesi);
    return cevap.liste.siparisler.length;
  }, []);

  useEffect(() => {
    void (async () => {
      const adet = await atamalariYukle();
      if (adet > 0) {
        setAdim("liste");
        return;
      }
      await firmalariYukle();
      setAdim("kargo");
    })();
  }, [atamalariYukle, firmalariYukle]);

  const ata = async (kargoFirmasi: string) => {
    setHata(null);
    setCalisiyor(true);
    const cevap = await paketAta(kargoFirmasi);
    setCalisiyor(false);

    if (!cevap.ok) {
      setHata(cevap.hata);
      return;
    }
    if (cevap.sonuc.sonuc === "hata") {
      ses.cal("hata");
      setHata(
        cevap.sonuc.hata === "bos"
          ? "Bu kargo firmasında bekleyen sipariş kalmadı."
          : "Paketleri başka bir çalışan aldı. Yeniden deneyin.",
      );
      await firmalariYukle();
      return;
    }

    await atamalariYukle();
    setAdim("liste");
  };

  const birak = async () => {
    setHata(null);
    setCalisiyor(true);
    const cevap = await atamalariBirak();
    setCalisiyor(false);
    if (!cevap.ok) {
      setHata(cevap.hata);
      return;
    }
    setSiparisler([]);
    setListe([]);
    await firmalariYukle();
    setAdim("kargo");
  };

  /** Tüm paketler bitti: yeni gruba geçmek için başa dön. */
  const bitir = async () => {
    await atamalariYukle();
    await firmalariYukle();
    setAdim("kargo");
  };

  if (adim === "yukleniyor") {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Yükleniyor</span>
        <Iskelet className="h-8 w-56" />
        <Iskelet className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hata && (
        <p
          role="alert"
          className="rounded-[--radius-kontrol] border border-destructive/40 bg-destructive-soft px-3 py-2 text-footnote text-destructive"
        >
          {hata}
        </p>
      )}

      {adim === "kargo" && (
        <KargoSec
          firmalar={firmalar}
          calisiyor={calisiyor}
          onSec={ata}
          onYenile={firmalariYukle}
        />
      )}

      {adim === "liste" && (
        <ToplamaListesi
          kalemler={liste}
          siparisSayisi={siparisler.length}
          calisiyor={calisiyor}
          onPaketle={() => setAdim("paketle")}
          onBirak={birak}
        />
      )}

      {adim === "paketle" && (
        <Paketle
          siparisler={siparisler}
          ses={ses}
          onBitti={bitir}
          onBirak={birak}
        />
      )}
    </div>
  );
}
