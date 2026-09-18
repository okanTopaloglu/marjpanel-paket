"use client";

import { useEffect, useState } from "react";

/**
 * Medya sorgusu aboneliği. Sunucuda ve ilk boyamada `false` döner; bu yüzden
 * çağıran taraf mobil sunumu varsayılan kabul eder (mobile-first).
 */
export function useMedyaSorgusu(sorgu: string): boolean {
  const [eslesiyor, setEslesiyor] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(sorgu);
    const guncelle = () => setEslesiyor(mql.matches);
    guncelle();
    mql.addEventListener("change", guncelle);
    return () => mql.removeEventListener("change", guncelle);
  }, [sorgu]);

  return eslesiyor;
}

/** Masaüstü yerleşimi (Tailwind `md`) etkin mi? */
export function useMasaustu(): boolean {
  return useMedyaSorgusu("(min-width: 768px)");
}
