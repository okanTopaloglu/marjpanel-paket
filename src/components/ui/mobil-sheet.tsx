"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HizIzleyici,
  ivmeIzdusumu,
  lastikBant,
  yayOynat,
  azaltilmisHareket,
  type YayKolu,
} from "@/lib/motion/yay";
import { cn } from "@/lib/utils";

/**
 * Alttan gelen sayfa (bottom sheet) — mobilde açılır menü yerine kullanılır.
 * Tutamağından aşağı sürüklenerek kapatılır; bırakışta parmağın hızı devralınır,
 * üst sınırda lastik bant direnci vardır ve animasyon her an yakalanabilir.
 */
export function MobilSheet({
  acik,
  onKapat,
  baslik,
  children,
  className,
}: {
  acik: boolean;
  onKapat: () => void;
  baslik?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [monte, setMonte] = useState(false);
  const [gorunur, setGorunur] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const perdeRef = useRef<HTMLDivElement | null>(null);
  const yukseklikRef = useRef(400);
  const yRef = useRef(0);
  const yayRef = useRef<YayKolu | null>(null);
  const hizRef = useRef(new HizIzleyici());
  const jestRef = useRef<{ y0: number; baz: number; id: number } | null>(null);
  /** `acik` prop'unun ref kopyası — yay bittiğinde bayat değer okunmasın. */
  const acikRef = useRef(acik);
  acikRef.current = acik;

  useEffect(() => setMonte(true), []);

  const ciz = useCallback((y: number) => {
    yRef.current = y;
    const h = yukseklikRef.current;
    if (sheetRef.current) sheetRef.current.style.transform = `translate3d(0,${y}px,0)`;
    if (perdeRef.current) {
      perdeRef.current.style.opacity = String(
        h > 0 ? Math.min(1, Math.max(0, 1 - y / h)) : 1,
      );
    }
  }, []);

  const yayaBirak = useCallback(
    (hedef: number, hiz: number) => {
      yayRef.current?.durdur();
      yayRef.current = yayOynat({
        baslangic: yRef.current,
        hedef,
        hiz,
        tepki: 0.3,
        sonum: Math.abs(hiz) > 200 ? 0.82 : 1,
        adim: (d) => ciz(d),
        bitti: () => {
          // Kapanış bitti — ama bu sırada yeniden açıldıysa portalı sökme.
          if (hedef !== 0 && !acikRef.current) setGorunur(false);
        },
      });
    },
    [ciz],
  );

  useEffect(() => {
    if (acik) {
      setGorunur(true);
      return;
    }
    if (!gorunur) return;
    if (azaltilmisHareket()) {
      setGorunur(false);
      return;
    }
    yayaBirak(yukseklikRef.current, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik]);

  /* Giriş animasyonu. Kapanış SÜRERKEN yeniden açılırsa hareket olduğu
     yerden geri çevrilir (alta ışınlanıp baştan açılmaz). */
  useEffect(() => {
    if (!gorunur || !acik) return;
    const el = sheetRef.current;
    if (!el) return;
    yukseklikRef.current = el.offsetHeight || 400;

    const kol = yayRef.current;
    if (kol?.calisiyor()) {
      const anlik = kol.durdur();
      yRef.current = anlik.deger;
      yayaBirak(0, anlik.hiz);
      return;
    }

    ciz(yukseklikRef.current);
    const id = requestAnimationFrame(() => yayaBirak(0, 0));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gorunur, acik]);

  useEffect(() => {
    if (!gorunur) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", onKey);
    };
  }, [gorunur, onKapat]);

  useEffect(() => () => void yayRef.current?.durdur(), []);

  function pointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const anlik = yayRef.current?.durdur();
    if (anlik) yRef.current = anlik.deger;
    jestRef.current = { y0: e.clientY, baz: yRef.current, id: e.pointerId };
    hizRef.current.sifirla(e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const j = jestRef.current;
    if (!j || j.id !== e.pointerId) return;
    hizRef.current.ekle(e.clientY);
    let y = j.baz + (e.clientY - j.y0);
    if (y < 0) y = -lastikBant(-y, yukseklikRef.current); // yukarı çekişte direnç
    ciz(y);
  }

  function pointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const j = jestRef.current;
    jestRef.current = null;
    if (!j) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* yoksay */
    }
    const hiz = hizRef.current.hiz();
    const h = yukseklikRef.current;
    const varis = yRef.current + ivmeIzdusumu(hiz);
    if (varis > h / 2) {
      onKapat();
      yayaBirak(h, hiz);
    } else {
      yayaBirak(0, hiz);
    }
  }

  if (!monte || !gorunur) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Kapanış animasyonu sürerken perde dokunuş yutmasın (çekmecedekiyle
          aynı hata): kullanıcı sayfa kapanırken zile tekrar basarsa dokunuş
          görünmez perdeye gider ve "basıyorum açılmıyor" olur. */}
      <div
        ref={perdeRef}
        onClick={onKapat}
        style={{
          opacity: 0,
          background: "var(--scrim)",
          pointerEvents: acik ? "auto" : "none",
        }}
        className="absolute inset-0"
      />
      <div
        ref={sheetRef}
        style={{ transform: "translate3d(0,100%,0)" }}
        className={cn(
          "pointer-events-auto relative max-h-[86svh] w-full overflow-hidden",
          // Sheet köşesi 16px — tek köşe ölçeğinin en büyük adımı.
          "rounded-t-[--radius-sheet] border-t border-border bg-card",
          "shadow-soft will-move",
          className,
        )}
      >
        {/* Tutamak — dokunma hedefi cömert, sürüklenebilir olduğu belli */}
        <div
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          style={{ touchAction: "none" }}
          className="flex cursor-grab touch-none flex-col items-center gap-2 px-4 pb-2 pt-2.5 active:cursor-grabbing"
        >
          <div aria-hidden="true" className="h-1 w-9 rounded-full bg-border" />
          {baslik && (
            <div className="w-full pb-1 text-center text-headline text-foreground">
              {baslik}
            </div>
          )}
        </div>
        <div
          className="max-h-[calc(86svh-4rem)] overflow-y-auto overscroll-contain pb-safe"
          onClickCapture={(e) => {
            // Kapanmakta olan sayfadaki içerik dokunuşla tetiklenmesin —
            // kullanıcı yüzeyi kapatıyor, altındaki satır yanlışlıkla açılmasın.
            if (!acikRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
