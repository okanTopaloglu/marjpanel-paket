"use client";

import { useEffect } from "react";

/**
 * OLAY İZLEYİCİ — tanıtım sayfasının TEK istemci bileşeni.
 *
 * Sayfanın geri kalanı sunucu bileşenidir; bu dosya yalnız iki iş yapar:
 * açılışta bir görüntüleme yazar ve iletişim bağlantılarına tıklamaları
 * yakalar. Her bağlantıya ayrı ayrı `onClick` koymak yerine TEK bir belge
 * dinleyicisi kullanılır (olay delegasyonu): işaretleme temiz kalır, yeni
 * bir bağlantı eklendiğinde izleme kendiliğinden çalışır.
 *
 * `sendBeacon`: kullanıcı bağlantıya tıklayıp sayfadan ayrılırken normal
 * `fetch` iptal edilebilir; beacon tarayıcıya "sen bunu arka planda yolla"
 * der ve gezinme beklemez.
 */

type Tur = "goruntuleme" | "eposta" | "telefon" | "teklif" | "kayit" | "giris" | "sss";

function yolla(tur: Tur, etiket?: string | null): void {
  try {
    const p = new URLSearchParams(window.location.search);
    const govde = JSON.stringify({
      tur,
      yol: window.location.pathname,
      etiket: etiket ?? null,
      yonlendiren: document.referrer || null,
      kaynak: p.get("utm_source") ?? p.get("kaynak"),
      kampanya: p.get("utm_campaign"),
    });
    /* Beacon yoksa (eski tarayıcı) fetch'e düş; ikisi de yoksa sessizce geç. */
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/olay", new Blob([govde], { type: "application/json" }));
    } else {
      void fetch("/api/olay", { method: "POST", body: govde, headers: { "content-type": "application/json" }, keepalive: true });
    }
  } catch {
    /* Analitik hiçbir koşulda sayfayı bozmaz. */
  }
}

export function OlayIzleyici() {
  useEffect(() => {
    yolla("goruntuleme");

    const tiklama = (olay: MouseEvent) => {
      const hedef = (olay.target as HTMLElement | null)?.closest<HTMLElement>("a, summary");
      if (!hedef) return;

      if (hedef.tagName === "SUMMARY") {
        // `<details>` açılırken yazılır; kapanışta değil.
        const d = hedef.closest("details");
        if (d && !d.open) yolla("sss", hedef.textContent?.trim().slice(0, 80) ?? null);
        return;
      }

      const href = hedef.getAttribute("href") ?? "";
      if (href.startsWith("mailto:")) {
        yolla(hedef.dataset.olay === "teklif" ? "teklif" : "eposta", href.replace("mailto:", "").split("?")[0] ?? null);
      } else if (href.startsWith("tel:")) {
        yolla("telefon", href.replace("tel:", ""));
      } else if (href === "/kayit") {
        yolla("kayit", hedef.textContent?.trim().slice(0, 40) ?? null);
      } else if (href === "/giris") {
        yolla("giris", hedef.textContent?.trim().slice(0, 40) ?? null);
      }
    };

    document.addEventListener("click", tiklama, { capture: true });
    return () => document.removeEventListener("click", tiklama, { capture: true });
  }, []);

  return null;
}
