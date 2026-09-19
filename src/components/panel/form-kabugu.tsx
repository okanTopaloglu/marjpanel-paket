"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { MobilSheet } from "@/components/ui/mobil-sheet";
import { useMasaustu } from "@/lib/hooks/medya";

/**
 * Form kabuğu — kayıt ekleme/düzenleme formlarının ortak taşıyıcısı.
 * Masaüstünde ortalanmış kart (body'ye portal), mobilde `MobilSheet` — AYNI
 * desen `onay-diyalogu.tsx`'te: iki ayrı yüzey elde tutmak yerine panelin
 * her yerinde kullanılan tek taşıyıcı.
 *
 * `kullanici-formu.tsx` ve `sirket-formu.tsx` bu kabuğu sarar; form alanları
 * ve `useActionState` mantığı çağıranda kalır.
 */
export function FormKabugu({
  acik,
  onKapat,
  baslik,
  children,
}: {
  acik: boolean;
  onKapat: () => void;
  baslik: React.ReactNode;
  children: React.ReactNode;
}) {
  const masaustu = useMasaustu();
  const id = useId();
  const kartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!acik || !masaustu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    kartRef.current?.focus();
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", onKey);
    };
  }, [acik, masaustu, onKapat]);

  if (!masaustu) {
    return (
      <MobilSheet acik={acik} onKapat={onKapat} baslik={baslik}>
        <div className="px-4 pb-4">{children}</div>
      </MobilSheet>
    );
  }

  if (!acik) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="presentation">
      <div
        onClick={onKapat}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
      />
      <div
        ref={kartRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="relative max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-[--radius] border border-border bg-card p-5 shadow-soft animate-materialize focus:outline-none"
      >
        <h2 id={id} className="mb-4 text-headline text-foreground">
          {baslik}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
