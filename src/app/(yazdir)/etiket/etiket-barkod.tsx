"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Takip numarası barkodu (CODE128).
 *
 * Etiketin iç genişliği 100mm - 2x4mm dolgu = 92mm; barkod sütunu bunun
 * sağındaki ~68mm'dir (solda QR karesi durur) = ~257 px (CSS 96dpi).
 *
 * SVG bu tavandan genişse CSS ile küçültülmez, DAHA İNCE MODÜLLE YENİDEN
 * ÇİZİLİR: kesirli CSS ölçeği çubuk kalınlıklarını tam piksele oturtmaz ve
 * termal baskıda tırtıklı, okunamayan bir kod çıkar. 96dpi'de 1 px'lik çubuk
 * 203dpi termal başlıkta ~2,11 noktaya düşer; okunabilirlik alt sınırı (2
 * nokta) korunur, yani `ciz(1)` güvenlidir.
 */
const AZAMI_GENISLIK_PX = 257;

export function EtiketBarkod({
  deger,
  azamiGenislikPx = AZAMI_GENISLIK_PX,
}: {
  deger: string;
  azamiGenislikPx?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !deger) return;
    try {
      const ciz = (modul: number) =>
        JsBarcode(svg, deger, {
          format: "CODE128",
          displayValue: false,
          height: 58,
          width: modul,
          margin: 0,
        });
      ciz(2);
      const genislik = Number(svg.getAttribute("width") ?? 0);
      if (genislik > azamiGenislikPx) ciz(1);
    } catch {
      // Geçersiz karakter: barkod boş kalır, numara metin olarak zaten basılı.
    }
  }, [deger, azamiGenislikPx]);

  return <svg ref={ref} className="max-w-full" aria-label={deger} />;
}
