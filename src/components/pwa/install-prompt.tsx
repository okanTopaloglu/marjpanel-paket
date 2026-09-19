"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, SquarePlus } from "lucide-react";
import { MamaAuraIsaret } from "@/components/marka/mama-aura";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KAPAT_ANAHTARI = "marjpanel-paket-pwa-kapatildi";
/** Davet ilk boyamayla yarışmasın; kullanıcı önce sayfayı görsün. */
const GECIKME_MS = 2500;

/**
 * "Uygulama olarak yükle" daveti.
 *
 * · Chrome/Edge/Android: `beforeinstallprompt` yakalanır - tek dokunuşla kurulum.
 * · iOS Safari: bu olay yok → "Paylaş → Ana Ekrana Ekle" talimatı gösterilir.
 *   Bu adım iPhone'da ANLIK BİLDİRİM için de zorunlu (iOS yalnız ana ekrana
 *   eklenmiş uygulamada Web Push'a izin verir), o yüzden bu vurgulanır.
 * · Zaten yüklüyse (standalone) veya kullanıcı kapattıysa hiç görünmez.
 */
export function InstallPrompt() {
  const [olay, setOlay] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosGoster, setIosGoster] = useState(false);
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (localStorage.getItem(KAPAT_ANAHTARI) === "1") return;
    } catch {
      /* özel modda localStorage kapalı olabilir */
    }

    let zamanlayici = 0;
    const gecikmeliGoster = () => {
      window.clearTimeout(zamanlayici);
      zamanlayici = window.setTimeout(() => setGorunur(true), GECIKME_MS);
    };

    const handler = (e: Event) => {
      e.preventDefault();
      setOlay(e as BeforeInstallPromptEvent);
      gecikmeliGoster();
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setGorunur(false);
      try {
        localStorage.setItem(KAPAT_ANAHTARI, "1");
      } catch {
        /* yoksay */
      }
    };
    window.addEventListener("appinstalled", installed);

    const ua = navigator.userAgent;
    const iOS =
      /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS 13+ masaüstü Safari gibi görünür
      (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
    const safari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
    if (iOS && safari) {
      setIosGoster(true);
      gecikmeliGoster();
    }

    return () => {
      window.clearTimeout(zamanlayici);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!gorunur) return null;

  function kapat() {
    setGorunur(false);
    try {
      localStorage.setItem(KAPAT_ANAHTARI, "1");
    } catch {
      /* yoksay */
    }
  }

  async function yukle() {
    if (!olay) return;
    await olay.prompt();
    const { outcome } = await olay.userChoice;
    setOlay(null);
    setGorunur(false);
    if (outcome === "dismissed") {
      try {
        localStorage.setItem(KAPAT_ANAHTARI, "1");
      } catch {
        /* yoksay */
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Uygulama olarak yükle"
      className={[
        "animate-in fixed inset-x-3 z-[80] mx-auto max-w-md",
        // Mobilde alt sekme çubuğunun üstünde durur; masaüstünde sağ altta.
        "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]",
        "md:bottom-5 md:left-auto md:right-5 md:mx-0",
        "material-thick overflow-hidden rounded-2xl border border-border/60 shadow-soft-xl",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={kapat}
        aria-label="Kapat"
        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-90"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3.5 p-4 pr-11">
        <MamaAuraIsaret boyut={44} />

        <div className="min-w-0 flex-1">
          <div className="text-headline text-foreground">
            MAMA AURA Paket&apos;i ana ekrana ekle
          </div>

          {iosGoster ? (
            <p className="mt-1 text-footnote text-muted-foreground">
              Alttaki{" "}
              <Share className="inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />{" "}
              <span className="font-medium text-foreground">Paylaş</span>&apos;a dokun,
              sonra{" "}
              <span className="font-medium text-foreground">
                Ana Ekrana Ekle{" "}
                <SquarePlus
                  className="inline h-3.5 w-3.5 -translate-y-px"
                  aria-hidden="true"
                />
              </span>{" "}
              seç.
            </p>
          ) : (
            <>
              <p className="mt-1 text-footnote text-muted-foreground">
                Tam ekran açılır, daha hızlı yüklenir; depoda tek dokunuşla
                okuma ekranına döner.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={yukle}
                  className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-grad-cta px-4 text-callout font-semibold text-cta-foreground shadow-soft transition-transform duration-150 ease-out active:scale-95"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Yükle
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
