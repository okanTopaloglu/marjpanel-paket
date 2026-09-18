"use client";

import { usePathname } from "next/navigation";

/** Her rota değişiminde içeriği yumuşakça belirir (fade-in-up). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-in">
      {children}
    </div>
  );
}
