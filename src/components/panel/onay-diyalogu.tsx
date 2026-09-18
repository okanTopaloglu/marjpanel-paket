"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { MobilSheet } from "@/components/ui/mobil-sheet";
import { Button } from "@/components/ui/button";
import { useMasaustu } from "@/lib/hooks/medya";
import { cn } from "@/lib/utils";

/**
 * Onay diyaloğu — yıkıcı ya da geri alınamaz eylemlerden önce tek soru
 * sorar. Masaüstünde ortalanmış kart (body'ye portal), mobilde `MobilSheet`
 * — panelin geri kalanıyla AYNI desen (`islemler-menusu.tsx`,
 * `filtre-cubugu.tsx`): tek bileşen sürdürmek yerine iki ayrı yüzeyi
 * elde tutmamak için.
 *
 * `tehlikeli` true iken onay düğmesi kırmızıdır ve bir uyarı ikonu görünür —
 * "sil", "iptal et" gibi geri alınamaz eylemler için.
 */
export function OnayDiyalogu({
  acik,
  baslik,
  aciklama,
  onaylaMetni = "Onayla",
  vazgecMetni = "Vazgeç",
  tehlikeli = false,
  onOnay,
  onKapat,
}: {
  acik: boolean;
  baslik: React.ReactNode;
  aciklama?: React.ReactNode;
  onaylaMetni?: string;
  vazgecMetni?: string;
  /** Yıkıcı eylem — onay düğmesi kırmızı olur. */
  tehlikeli?: boolean;
  onOnay: () => void;
  onKapat: () => void;
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
    // Açılışta odak onay düğmesine değil karta gider — ekran okuyucu
    // diyaloğu okumaya başlasın, yanlışlıkla erken onaya basılmasın.
    kartRef.current?.focus();
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", onKey);
    };
  }, [acik, masaustu, onKapat]);

  const govde = (
    <>
      <div className="flex items-start gap-3">
        {tehlikeli && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h2 id={id} className="text-headline text-foreground">
            {baslik}
          </h2>
          {aciklama && (
            <p className="text-footnote text-muted-foreground">{aciklama}</p>
          )}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onKapat}>
          {vazgecMetni}
        </Button>
        <Button
          type="button"
          variant={tehlikeli ? "destructive" : "default"}
          onClick={() => {
            onOnay();
          }}
        >
          {onaylaMetni}
        </Button>
      </div>
    </>
  );

  if (!masaustu) {
    return (
      <MobilSheet acik={acik} onKapat={onKapat} baslik={baslik}>
        <div className="px-4 pb-4">
          {aciklama && (
            <p className="mb-4 text-footnote text-muted-foreground">{aciklama}</p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              variant={tehlikeli ? "destructive" : "default"}
              onClick={onOnay}
            >
              {onaylaMetni}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={onKapat}>
              {vazgecMetni}
            </Button>
          </div>
        </div>
      </MobilSheet>
    );
  }

  if (!acik) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        onClick={onKapat}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
      />
      <div
        ref={kartRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-sm rounded-[--radius] border border-border bg-card p-5",
          "shadow-soft animate-materialize focus:outline-none",
        )}
      >
        {govde}
      </div>
    </div>,
    document.body,
  );
}
