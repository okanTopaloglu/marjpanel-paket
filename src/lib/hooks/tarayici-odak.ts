"use client";

import { useEffect, type RefObject } from "react";

/**
 * EL TERMİNALİ ODAĞI.
 *
 * Barkod okuyucu bir klavyedir: okuduğu değeri ODAKTAKİ alana yazar. Odak
 * kaybolduğu an okutma sessizce kaybolur - kullanıcı "cihaz bozuldu" sanır.
 * Bu kanca, sayfaya her dokunuşta odağı barkod alanına geri çeker.
 *
 * İSTİSNALAR (odak zorla geri alınmaz):
 *  · `[data-odak-serbest]` içindeki bir öğeye tıklandıysa - mağaza seçici,
 *    filtre, menü gibi kendi girdisi olan bölgeler.
 *  · Açık bir diyalog/sheet varsa - onay diyaloğundaki düğmeye basmak
 *    imkânsız hâle gelmesin.
 *  · Tıklanan öğe başka bir yazılabilir alansa (input, textarea, select,
 *    contenteditable).
 *
 * Sekme geri gelince (`visibilitychange`) odak yeniden alınır: kullanıcı
 * başka sekmeye bakıp döndüğünde ilk okutma boşa gitmesin.
 */
export function useTarayiciOdak(
  ref: RefObject<HTMLInputElement | null>,
  { etkin = true }: { etkin?: boolean } = {},
): void {
  useEffect(() => {
    if (!etkin) return;

    const odakla = () => {
      const alan = ref.current;
      if (!alan || alan.disabled) return;
      if (document.activeElement === alan) return;
      alan.focus();
    };

    const serbestMi = (hedef: EventTarget | null): boolean => {
      if (!(hedef instanceof Element)) return false;
      if (hedef.closest("[data-odak-serbest]")) return true;
      if (hedef.closest('[role="dialog"], [role="alertdialog"]')) return true;
      const yazilabilir = hedef.closest(
        "input, textarea, select, [contenteditable='true'], button",
      );
      // Düğmeye basıldıysa odağı hemen çalmayız (basma geri bildirimi ve
      // klavye gezinmesi bozulmasın); düğme kendi işini bitirince akış
      // zaten alana döner.
      return !!yazilabilir && yazilabilir !== ref.current;
    };

    const acikDiyalogVarMi = () =>
      !!document.querySelector('[role="dialog"], [role="alertdialog"]');

    const tiklama = (olay: MouseEvent) => {
      if (acikDiyalogVarMi()) return;
      if (serbestMi(olay.target)) return;
      // Tıklamanın kendi odak işini bitirmesini bekle.
      requestAnimationFrame(odakla);
    };

    const gorunurluk = () => {
      if (document.visibilityState !== "visible") return;
      if (acikDiyalogVarMi()) return;
      requestAnimationFrame(odakla);
    };

    odakla();
    document.addEventListener("click", tiklama);
    document.addEventListener("visibilitychange", gorunurluk);
    return () => {
      document.removeEventListener("click", tiklama);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [ref, etkin]);
}
