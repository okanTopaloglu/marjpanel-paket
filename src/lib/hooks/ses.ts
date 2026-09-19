"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * OKUTMA SESLERİ.
 *
 * Depoda kullanıcı ekrana bakmaz, paketle uğraşır: sonucu KULAK ile alır.
 * Üç ton yeter - başarı (kısa tiz), uyarı (orta çift vuruş), hata (kalın
 * testere). Ses dosyası YOK: birkaç yüz baytlık osilatör hem anında çalar
 * hem ağ beklemez (PartnerSys `playSuccessSound` portu).
 *
 * `AudioContext` TEMBEL kurulur ve TEK örnek tutulur: tarayıcılar kullanıcı
 * etkileşimi olmadan ses bağlamı açmaya izin vermez, ayrıca her seste yeni
 * bağlam açmak (PartnerSys'in yaptığı) uzun vardiyada bağlam sızdırır.
 *
 * Sessiz mod `localStorage`'da yaşar (`paket-ses-kapali`): tercihi kullanıcı
 * kendi cihazı için verir, hesabına yazmaya değmez.
 */

const DEPO_ANAHTARI = "paket-ses-kapali";

export type SesTonu = "basari" | "hata" | "uyari";

interface TonTanimi {
  /** [frekans, süre(sn)] çiftleri; birden çok çift = art arda vuruş. */
  vurus: Array<[number, number]>;
  tip: OscillatorType;
  ses: number;
}

const TONLAR: Record<SesTonu, TonTanimi> = {
  basari: { vurus: [[880, 0.1]], tip: "sine", ses: 0.28 },
  uyari: {
    vurus: [
      [660, 0.09],
      [520, 0.12],
    ],
    tip: "triangle",
    ses: 0.28,
  },
  hata: { vurus: [[200, 0.22]], tip: "sawtooth", ses: 0.3 },
};

function depodanOku(): boolean {
  try {
    return localStorage.getItem(DEPO_ANAHTARI) === "1";
  } catch {
    // Özel sekme / depolama kapalı - ses açık kabul edilir.
    return false;
  }
}

export interface SesKontrolu {
  cal: (ton: SesTonu) => void;
  kapali: boolean;
  /** Sessiz modu açıp kapatır ve tercihi cihaza yazar. */
  degistir: () => void;
}

export function useSes(): SesKontrolu {
  const [kapali, setKapali] = useState(false);
  const baglamRef = useRef<AudioContext | null>(null);

  // İlk boyama sunucuyla aynı olsun diye tercih montajdan SONRA okunur.
  useEffect(() => setKapali(depodanOku()), []);

  useEffect(
    () => () => {
      void baglamRef.current?.close();
      baglamRef.current = null;
    },
    [],
  );

  const cal = useCallback(
    (ton: SesTonu) => {
      if (kapali || typeof window === "undefined") return;

      try {
        const Yapici =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Yapici) return;

        const baglam = (baglamRef.current ??= new Yapici());
        // Sekme arka plandayken bağlam askıya alınır; ilk okutmada uyandır.
        if (baglam.state === "suspended") void baglam.resume();

        const tanim = TONLAR[ton];
        let an = baglam.currentTime;
        for (const [frekans, sure] of tanim.vurus) {
          const osilator = baglam.createOscillator();
          const kazanc = baglam.createGain();
          osilator.connect(kazanc);
          kazanc.connect(baglam.destination);
          osilator.type = tanim.tip;
          osilator.frequency.value = frekans;
          kazanc.gain.setValueAtTime(tanim.ses, an);
          kazanc.gain.exponentialRampToValueAtTime(0.01, an + sure);
          osilator.start(an);
          osilator.stop(an + sure);
          an += sure;
        }
      } catch {
        // Ses çalınamadıysa okutma akışı DURMAZ; görsel geri bildirim yeter.
      }
    },
    [kapali],
  );

  const degistir = useCallback(() => {
    setKapali((onceki) => {
      const yeni = !onceki;
      try {
        if (yeni) localStorage.setItem(DEPO_ANAHTARI, "1");
        else localStorage.removeItem(DEPO_ANAHTARI);
      } catch {
        // Yazamasak da oturum boyunca tercih geçerli olur.
      }
      return yeni;
    });
  }, []);

  return { cal, kapali, degistir };
}
