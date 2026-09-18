"use client";

import { useEffect } from "react";

/**
 * Service worker kaydı + güncelleme yönetimi.
 *
 * Yeni bir sürüm hazır olduğunda beklemede kalmasın: SW'ye "hemen devral"
 * denir ve kontrol değiştiğinde sayfa BİR KEZ yenilenir. Böylece kullanıcı
 * eski bir kabuğa takılı kalmaz (mobilde uygulama günlerce açık kalabiliyor).
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let yenilendi = false;
    const kontrolDegisti = () => {
      if (yenilendi) return;
      yenilendi = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", kontrolDegisti);

    let kayitRef: ServiceWorkerRegistration | null = null;

    const bekleyeniDevralt = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) reg.waiting.postMessage({ tip: "hemen-devral" });
    };

    const kaydet = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        kayitRef = reg;
        bekleyeniDevralt(reg);
        reg.addEventListener("updatefound", () => {
          const yeni = reg.installing;
          if (!yeni) return;
          yeni.addEventListener("statechange", () => {
            // Zaten bir kontrolcü varsa bu bir GÜNCELLEME; devralsın.
            if (yeni.state === "installed" && navigator.serviceWorker.controller) {
              bekleyeniDevralt(reg);
            }
          });
        });
      } catch {
        /* SW yoksa uygulama yine çalışır, sadece PWA özellikleri kapalı */
      }
    };

    if (document.readyState === "complete") void kaydet();
    else window.addEventListener("load", () => void kaydet(), { once: true });

    // Uygulamaya her dönüşte güncellemeyi yokla (mobilde sekme günlerce açık).
    const gorunurluk = () => {
      if (document.visibilityState === "visible") void kayitRef?.update();
    };
    document.addEventListener("visibilitychange", gorunurluk);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", kontrolDegisti);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, []);

  return null;
}
