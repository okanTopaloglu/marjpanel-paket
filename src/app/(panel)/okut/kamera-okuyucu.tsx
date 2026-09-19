"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * KAMERA İLE OKUTMA - telefonun el terminali yerine geçtiği hâl.
 *
 * `next/dynamic` + `ssr:false` ile YÜKLENİR (bkz. `okut-ekrani.tsx`):
 * html5-qrcode `window`/`navigator` olmadan içe aktarılamaz ve ~100 KB'dir;
 * masaüstünde hiç indirilmemesi gerekir.
 *
 * Aynı barkod kamera önünde dururken saniyede onlarca kez çözülür; 1,5
 * saniyelik tekrar eşiği (`TEKRAR_ESIGI_MS`) olmasaydı tek pakette onlarca
 * "mükerrer" perdesi açılırdı.
 */

const TEKRAR_ESIGI_MS = 1500;
const OKUYUCU_ID = "kamera-okuyucu-alani";

const BICIMLER = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export default function KameraOkuyucu({
  onOkut,
  onKapat,
  okunanSayisi,
}: {
  onOkut: (barkod: string) => void;
  onKapat: () => void;
  okunanSayisi: number;
}) {
  const [hata, setHata] = useState<string | null>(null);
  const [baslatiliyor, setBaslatiliyor] = useState(true);
  const sonRef = useRef<{ barkod: string; zaman: number }>({
    barkod: "",
    zaman: 0,
  });
  const onOkutRef = useRef(onOkut);
  onOkutRef.current = onOkut;

  useEffect(() => {
    // Desteklenen biçimler YAPICIYA verilir (tarama yapılandırmasına değil):
    // liste daraldıkça çözümleme hızlanır, yanlış okuma azalır.
    const okuyucu = new Html5Qrcode(OKUYUCU_ID, {
      formatsToSupport: BICIMLER,
      verbose: false,
    });
    let durduruldu = false;

    okuyucu
      .start(
        // Arka kamera: depoda telefon paketin üstüne tutulur.
        { facingMode: "environment" },
        {
          fps: 20,
          qrbox: { width: 240, height: 110 },
          disableFlip: true,
        },
        (metin) => {
          const barkod = (metin ?? "").trim();
          if (!barkod) return;
          const simdi = Date.now();
          const son = sonRef.current;
          if (son.barkod === barkod && simdi - son.zaman < TEKRAR_ESIGI_MS) {
            return;
          }
          sonRef.current = { barkod, zaman: simdi };
          onOkutRef.current(barkod);
        },
        () => {
          // Kare çözülemedi - normal, sessiz geç.
        },
      )
      .then(() => setBaslatiliyor(false))
      .catch((e: Error) => {
        setBaslatiliyor(false);
        setHata(
          e?.message ||
            "Kamera açılamadı. Tarayıcıda kamera izni verdiğinizden emin olun.",
        );
      });

    return () => {
      if (durduruldu) return;
      durduruldu = true;
      okuyucu
        .stop()
        .then(() => {
          const alan = document.getElementById(OKUYUCU_ID);
          if (alan) alan.innerHTML = "";
        })
        .catch(() => {
          // Zaten durmuşsa yapacak bir şey yok.
        });
    };
  }, []);

  return (
    <div
      data-odak-serbest
      className="fixed inset-0 z-[90] flex flex-col bg-ink text-ink-foreground"
      role="dialog"
      aria-label="Kamera ile barkod okut"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 pt-safe">
        <div className="min-w-0">
          <p className="text-headline">Kamera ile okut</p>
          <p className="tabular text-footnote opacity-80">
            {okunanSayisi} paket okutuldu
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onKapat}
          className="text-ink-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
          Kapat
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div id={OKUYUCU_ID} className="h-full w-full [&_video]:object-cover" />
        {(baslatiliyor || hata) && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-body">
              {hata ?? "Kamera hazırlanıyor..."}
            </p>
          </div>
        )}
      </div>

      <p className="px-4 py-3 pb-safe text-center text-footnote opacity-80">
        Barkodu çerçevenin içine alın. Aynı paket iki kez okunmaz.
      </p>
    </div>
  );
}
