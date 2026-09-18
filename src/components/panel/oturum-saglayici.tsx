"use client";

import { createContext, useContext } from "react";
import type { OturumOzeti } from "@/lib/auth/kapsam";

/**
 * Oturum sağlayıcı — istemci tarafında oturum özetini taşır.
 *
 * `rol-provider.tsx`'in (marjpanel) yerini alır: orada yalnız kaba bir rol
 * dizesi vardı, burada panel menüsünün ve mod kararlarının ihtiyaç duyduğu
 * TÜM özet (`OturumOzeti`) tek bağlamda durur. Kimlik/şirket kimlikleri
 * içermez — bkz. `lib/auth/kapsam.ts`.
 */
const OturumContext = createContext<OturumOzeti | null>(null);

export function OturumSaglayici({
  ozet,
  children,
}: {
  ozet: OturumOzeti;
  children: React.ReactNode;
}) {
  return (
    <OturumContext.Provider value={ozet}>{children}</OturumContext.Provider>
  );
}

/** Oturum özeti. Sağlayıcı dışında çağrılırsa hata fırlatır — sessiz `null` yerine. */
export function useOturum(): OturumOzeti {
  const ozet = useContext(OturumContext);
  if (!ozet) {
    throw new Error("useOturum, OturumSaglayici dışında çağrıldı.");
  }
  return ozet;
}

/** true → admin ya da super_admin. */
export function useAdminMi(): boolean {
  const { rol } = useOturum();
  return rol === "admin" || rol === "super_admin";
}

/** true → yalnız super_admin. */
export function useSuperMi(): boolean {
  const { rol } = useOturum();
  return rol === "super_admin";
}
