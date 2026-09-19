"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Takip numarasının karekodu.
 *
 * `toDataURL` ile PNG üretilir (SVG değil): karekod küçük bir kare ve termal
 * baskıda modüllerin tam piksele oturması, vektör ölçeklemesinden daha
 * güvenilir. Üretim tarayıcıda olur - sunucuda üretip HTML'e gömmek sayfa
 * yükünü 20 etikette yüz kilobaytlarca şişirirdi.
 *
 * Sessiz bölge (`margin: 1`) KODUN İÇİNDE bırakılır: kenarına dayalı basılan
 * kod telefonda okunmaz.
 */
export function EtiketQr({ deger, boyut = 72 }: { deger: string; boyut?: number }) {
  const [kaynak, setKaynak] = useState<string | null>(null);

  useEffect(() => {
    let sokuldu = false;
    if (!deger) return;
    void QRCode.toDataURL(deger, { width: boyut * 2, margin: 1 })
      .then((veri) => {
        if (!sokuldu) setKaynak(veri);
      })
      .catch(() => {
        // Karekod üretilemezse etiket barkodla basılır; boş kare bırakılır.
      });
    return () => {
      sokuldu = true;
    };
  }, [deger, boyut]);

  if (!kaynak) return <span style={{ width: boyut, height: boyut }} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- veri URL'i; next/image işleyemez.
    <img
      src={kaynak}
      alt=""
      width={boyut}
      height={boyut}
      className="etiket-qr block"
      style={{ width: boyut, height: boyut }}
    />
  );
}
