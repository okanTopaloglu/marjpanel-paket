"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bilgi ipucu — küçük "?" ikonu, dokununca ya da üzerine gelince açıklama.
 *
 * E-TİCARET MÜŞTERİSİNE DÖNÜK. Panelde "buybox", "hizmet bedeli", "iade
 * maliyeti" gibi terimler var; her birine satır içi bir cümle eklemek
 * arayüzü şişirir, hiç açıklamamak da satıcıyı tahmine bırakır. İpucu
 * açıklamayı isteyene verir.
 *
 * DOKUNMATİKTE DE ÇALIŞIR: yalnız hover'a bağlı bir ipucu telefonda hiç
 * açılmaz. Düğme tıklamayla açılıp kapanır; imleçli cihazda üzerine gelmek
 * de açar.
 *
 * Yerleşim `position: fixed` ile ekrana göre yapılır: tabloların ve kaydırma
 * alanlarının `overflow` kutusu içinde kalan bir popover kırpılırdı.
 */
export function BilgiIpucu({
  metin,
  className,
}: {
  metin: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const [acik, setAcik] = useState(false);
  const [konum, setKonum] = useState<{
    ust: number;
    sol: number;
    yon: "ust" | "alt";
  } | null>(null);
  const dugmeRef = useRef<HTMLButtonElement | null>(null);

  /* Konumu her açılışta ölç: sayfa kaydırılmış olabilir, düğme tablo
     içinde yatay kaymış olabilir. */
  useEffect(() => {
    if (!acik) return;
    const el = dugmeRef.current;
    if (!el) return;

    const hesapla = () => {
      const r = el.getBoundingClientRect();
      const GENISLIK = 260;
      const BOSLUK = 8;
      // Üstte yer yoksa alta aç — ipucu ekranın dışına taşmasın.
      const yon: "ust" | "alt" = r.top > 120 ? "ust" : "alt";
      const sol = Math.min(
        Math.max(BOSLUK, r.left + r.width / 2 - GENISLIK / 2),
        window.innerWidth - GENISLIK - BOSLUK,
      );
      setKonum({
        ust: yon === "ust" ? r.top - BOSLUK : r.bottom + BOSLUK,
        sol,
        yon,
      });
    };

    hesapla();
    const kapat = () => setAcik(false);
    window.addEventListener("scroll", kapat, true);
    window.addEventListener("resize", kapat);
    return () => {
      window.removeEventListener("scroll", kapat, true);
      window.removeEventListener("resize", kapat);
    };
  }, [acik]);

  /* ESC ve dışarı tıklama kapatır. */
  useEffect(() => {
    if (!acik) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    const onDown = (e: PointerEvent) => {
      if (!dugmeRef.current?.contains(e.target as Node)) setAcik(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [acik]);

  return (
    <>
      <button
        ref={dugmeRef}
        type="button"
        aria-label="Açıklama"
        aria-expanded={acik}
        aria-describedby={acik ? id : undefined}
        onClick={() => setAcik((a) => !a)}
        onMouseEnter={() => setAcik(true)}
        onMouseLeave={() => setAcik(false)}
        onFocus={() => setAcik(true)}
        onBlur={() => setAcik(false)}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center align-middle",
          "text-muted-foreground transition-colors duration-dokunma ease-out",
          "[@media(hover:hover)and(pointer:fine)]:hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "rounded-full",
          className,
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {acik && konum && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "fixed",
            top: konum.ust,
            left: konum.sol,
            width: 260,
            transform: konum.yon === "ust" ? "translateY(-100%)" : undefined,
            // Kaynağından açılsın: ipucu düğmenin bulunduğu kenardan büyür.
            transformOrigin:
              konum.yon === "ust" ? "bottom center" : "top center",
          }}
          className={cn(
            "z-[80] block rounded-[--radius-kontrol] border border-border bg-card p-3",
            "text-footnote text-foreground shadow-soft",
            // 150ms: ipucu bir yüzey değil bir cevap; bekletmemeli.
            "animate-[materialize_150ms_var(--ease-out)_both]",
          )}
        >
          {metin}
        </span>
      )}
    </>
  );
}
