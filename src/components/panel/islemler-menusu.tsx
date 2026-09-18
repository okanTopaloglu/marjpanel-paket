"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { MobilSheet } from "@/components/ui/mobil-sheet";
import { useMasaustu } from "@/lib/hooks/medya";
import { cn } from "@/lib/utils";

/**
 * "İşlemler" menüsü — sayfanın İKİNCİL ve NADİR eylemlerinin tek yuvası.
 *
 * NEDEN VAR: Siparişler ekranında yedi aksiyon (yazdır, otomatik yazdır,
 * kurulum, aracı, şimdi çek…) filtrelerin arasına serpilmişti ve liste ancak
 * beş kontrol satırının altında başlıyordu. Birincil eylem başlıkta kalır;
 * geri kalanı buraya iner. Kullanıcı "bir şey yapacağım" dediğinde tek yere
 * bakar.
 *
 * · Masaüstü: tetikleyicinin altında açılan menü.
 * · Mobil: alttan sheet — dar ekranda menü zaten ekranı kaplıyordu ve
 *   44px'lik dokunma hedefleri sheet'te rahat sığıyor.
 *
 * Maddeler `React.ReactNode` DEĞİL veri olarak alınır: menü kendi klavye
 * gezinmesini ve kapanmasını yönetebilsin, çağıran her maddede ayrı
 * `onClick={() => setAcik(false)}` yazmasın.
 */
export interface IslemMaddesi {
  key: string;
  etiket: string;
  ikon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Etiketin altında tek satır açıklama. */
  aciklama?: string;
  onSelect?: () => void;
  /** Verilirse madde bağlantı olur (yeni sekme için `hedef`). */
  href?: string;
  hedef?: "_blank";
  pasif?: boolean;
  /** Yıkıcı eylem — kırmızı metin. */
  tehlikeli?: boolean;
}

export function IslemlerMenusu({
  maddeler,
  etiket = "İşlemler",
  className,
  yalnizIkon = false,
}: {
  maddeler: IslemMaddesi[];
  etiket?: string;
  className?: string;
  /** Dar tablo hücreleri: etiket ekran okuyucuya kalır, tetikleyici kare olur. */
  yalnizIkon?: boolean;
}) {
  const menuId = useId();
  const [acik, setAcik] = useState(false);
  const sarmalRef = useRef<HTMLDivElement | null>(null);
  // Sheet body'ye PORTALLANIR; sarmalayicidaki `md:hidden` ona islemez. Canlida
  // masaustunde popover ile sheet birlikte aciliyordu: sheet yalniz mobilde cizilir.
  const masaustu = useMasaustu();

  /*
   * MASAÜSTÜ MENÜSÜ BODY'YE PORTALLANIR ve tetikleyicinin ekran konumuna
   * SABİTLENİR. Neden: menü kart/tablo sarmalayıcılarının içinde `absolute`
   * dururken `overflow-hidden`/`overflow-x-auto` kapları onu kırpıyordu ve
   * canlıda "menü kartın altında kalıyor" görünüyordu. Portal + `fixed` bu
   * kırpmadan çıkar; konum açılışta ölçülür, kaydırma/yeniden boyutlamada
   * menü kapanır (yanlış yerde asılı kalmasın).
   */
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [konum, setKonum] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    yukari: boolean;
    maxHeight: number;
  } | null>(null);

  /*
   * Konum, menü DOM'a commit edildikten SONRA (ama boyanmadan önce) tek bir
   * useLayoutEffect'te hesaplanır: portal `acik && masaustu` olduğunda konum
   * henüz belirlenmemişken de render edilir (aşağıdaki JSX'e bakın), böylece
   * `menuRef.current.offsetHeight` gerçek yüksekliği verir. Sabit eşikle
   * ("altta ~20rem yoksa yukarı aç") karar vermek gerçek yükseklikle
   * uyuşmuyordu: menü 8 maddeyle ~450px'e çıkınca hem altta hem üstte yer
   * yetmediği durumlarda üstü viewport dışında kalıp KIRPILIYORDU. Şimdi
   * hangi tarafa daha çok alan varsa oraya açılır VE o tarafa da sığmıyorsa
   * `maxHeight` ile menü kendi içinde kaydırılır (kırpma yerine scroll).
   */
  useLayoutEffect(() => {
    if (!acik || !masaustu) {
      setKonum(null);
      return;
    }
    const r = sarmalRef.current?.getBoundingClientRect();
    const menuYuk = menuRef.current?.offsetHeight;
    if (!r || !menuYuk) return;
    const bosluk = 8;
    const altAlan = window.innerHeight - r.bottom - bosluk;
    const ustAlan = r.top - bosluk;
    // Aşağı sığıyorsa aşağı; sığmıyorsa hangi taraf daha bolsa oraya.
    const yukari = menuYuk > altAlan && ustAlan > altAlan;
    const kullanilabilirAlan = yukari ? ustAlan : altAlan;
    setKonum({
      right: Math.min(
        Math.max(bosluk, window.innerWidth - r.right),
        window.innerWidth - 256 - bosluk,
      ),
      yukari,
      maxHeight: Math.max(160, kullanilabilirAlan),
      ...(yukari
        ? { bottom: window.innerHeight - r.top + bosluk }
        : { top: r.bottom + bosluk }),
    });
  }, [acik, masaustu]);

  /*
   * Dışarı tıklama (pointerdown) ve kaydırma/yeniden boyutlama kapanışı
   * YALNIZ masaüstünde bağlanır. NEDEN: mobilde menü MobilSheet ile
   * document.body'ye AYRI bir portala çizilir ve `menuRef` yalnız masaüstü
   * portalına bağlıdır — sheet'in kendisi `sarmalRef`/`menuRef` dışında
   * kalır. Bu dinleyici mobilde de bağlı kalsaydı sheet içindeki her dokunuş
   * "dışarı tıklama" sayılıp `setAcik(false)` çalıştırıyordu; hemen ardından
   * gelen click ise MobilSheet'in kendi `onClickCapture`'ı (`!acikRef.current`
   * iken preventDefault+stopPropagation) tarafından yutuluyordu — sonuç:
   * madde `onSelect` HİÇ tetiklenmiyordu (mobilde "hiçbir işlem yapılamıyor").
   * MobilSheet zaten perde tıklaması ve sürükleme jestiyle kendini kapatır,
   * bu yüzden mobilde ayrı bir dışarı-tıklama takibine gerek yok.
   * ESC ise her iki modda da kalır (klavye erişilebilirliği).
   */
  useEffect(() => {
    if (!acik) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [acik]);

  useEffect(() => {
    if (!acik || !masaustu) return;
    const onDown = (e: PointerEvent) => {
      const hedef = e.target as Node;
      // Portaldaki menü sarmalayıcının DIŞINDA durur; ona tıklamak "dışarı"
      // değildir, yoksa madde tıklaması menüyü tıklamadan önce kapatırdı.
      if (sarmalRef.current?.contains(hedef) || menuRef.current?.contains(hedef)) return;
      setAcik(false);
    };
    // SAYFA kaydırılınca menü kapanır (konumu tetikleyiciye sabit, asılı
    // kalmasın). Menünün KENDİ içindeki kaydırma İSTİSNADIR: maxHeight'lı
    // uzun menü overflow-y-auto ile kayar ve o scroll olayı da buraya
    // capture ile düşer — kapatsaydık kullanıcı listeyi hiç kaydıramazdı
    // (10.09.2026 canlı vakası: "menü sığmıyor, scroll çalışmıyor").
    const onKaydir = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setAcik(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onKaydir, true);
    window.addEventListener("resize", onKaydir);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onKaydir, true);
      window.removeEventListener("resize", onKaydir);
    };
  }, [acik, masaustu]);

  if (maddeler.length === 0) return null;

  const govde = (
    <ul className="flex flex-col">
      {maddeler.map((m) => {
        const Ikon = m.ikon;
        const icerik = (
          <>
            {Ikon && (
              <Ikon className="h-4 w-4 shrink-0 opacity-70" aria-hidden={true} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{m.etiket}</span>
              {m.aciklama && (
                <span className="block truncate text-caption font-medium text-muted-foreground">
                  {m.aciklama}
                </span>
              )}
            </span>
          </>
        );
        const ortak = cn(
          "flex min-h-touch w-full items-center gap-2.5 px-3 py-2 text-left",
          "text-callout font-medium text-foreground",
          "transition-colors duration-dokunma ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          m.tehlikeli && "text-destructive",
          m.pasif
            ? "pointer-events-none opacity-45"
            : "cursor-pointer [@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
        );

        return (
          <li key={m.key}>
            {m.href ? (
              <a
                href={m.href}
                target={m.hedef}
                rel={m.hedef === "_blank" ? "noopener" : undefined}
                onClick={() => setAcik(false)}
                className={ortak}
              >
                {icerik}
              </a>
            ) : (
              <button
                type="button"
                disabled={m.pasif}
                onClick={() => {
                  m.onSelect?.();
                  setAcik(false);
                }}
                className={ortak}
              >
                {icerik}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={sarmalRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        aria-haspopup="menu"
        aria-controls={acik ? menuId : undefined}
        className={cn(
          "press inline-flex h-9 cursor-pointer items-center justify-center rounded-[--radius-kontrol] border border-input bg-card",
          yalnizIkon ? "w-9" : "w-full gap-2 px-3 sm:w-auto",
          "text-[0.875rem] font-semibold text-foreground",
          "transition-colors duration-dokunma ease-out",
          "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={yalnizIkon ? "sr-only" : undefined}>{etiket}</span>
      </button>

      {/* Masaüstü menüsü: body'ye portal, tetikleyicinin konumuna sabit,
          kaynağından (sağ üst ya da sağ alt köşe) ölçeklenir.
          `konum` belirlenene kadar da (ölçüm turu) render edilir — yüksekliği
          okuyabilmek için DOM'da olması gerekir — ama `visibility:hidden` ile
          gizli tutulur ve animasyon sınıfı eklenmez; tek bir kare bile yanlış
          yerde/konumsuz çizilmesin. */}
      {acik && masaustu &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            style={{
              position: "fixed",
              right: konum?.right,
              top: konum?.top,
              bottom: konum?.bottom,
              maxHeight: konum?.maxHeight,
              visibility: konum ? "visible" : "hidden",
            }}
            className={cn(
              "z-[80] w-64",
              konum?.yukari ? "origin-bottom-right" : "origin-top-right",
              "overflow-y-auto rounded-[--radius] border border-border bg-card py-1 shadow-soft",
              konum && "animate-materialize",
            )}
          >
            {govde}
          </div>,
          document.body,
        )}

      {/* Mobil: aynı maddeler, alttan sheet. */}
      {!masaustu && (
        <MobilSheet acik={acik} onKapat={() => setAcik(false)} baslik={etiket}>
          <div className="pb-4">{govde}</div>
        </MobilSheet>
      )}
    </div>
  );
}
