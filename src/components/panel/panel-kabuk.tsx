"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MamaAuraIsaret, MamaAuraYazi, PanelAltBilgi } from "@/components/marka/mama-aura";
import { SidebarNav } from "@/components/panel/sidebar-nav";
import { PageTransition } from "@/components/panel/page-transition";
import { MobilMenuSaglayici } from "@/components/panel/mobile-nav";
import { MobilTabBar } from "@/components/panel/mobil-tab-bar";
import { useKaliciDurum } from "@/components/tables/kalici-filtre";
import { cn } from "@/lib/utils";

/**
 * Panel kabuğu.
 *
 * · Masaüstünde 240px MÜREKKEP sol menü (#0F1B2D): üstte wordmark, altta
 *   daraltma. İçerik onun yanında akar, altından değil — mürekkep şerit
 *   sayfanın sabit sol kenarıdır, yüzen bir katman değil.
 * · Kapalıyken yalnız ikonlara daralır (localStorage'da kalıcı); fare üzerine
 *   gelince içeriğin ÜZERİNE taşarak geçici açılır — sayfa kaymaz.
 * · Mobilde sol menü yok; yerine jestle sürülen çekmece + alt sekme çubuğu.
 */
export function PanelKabuk({
  topbar,
  children,
}: {
  topbar: ReactNode;
  children: ReactNode;
}) {
  const [menuDurum, setMenuDurum] = useKaliciDurum<"acik" | "kapali">(
    "panel:menu",
    "acik",
  );
  const kapali = menuDurum === "kapali";
  const [ustunde, setUstunde] = useState(false);
  const dar = kapali && !ustunde;

  return (
    <MobilMenuSaglayici>
      <div className="relative flex min-h-svh">
        <aside
          onMouseEnter={() => kapali && setUstunde(true)}
          onMouseLeave={() => setUstunde(false)}
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col bg-ink pl-safe",
            "transition-[width,box-shadow] duration-yuzey ease-out md:flex",
            dar ? "w-[4.5rem]" : "w-60",
            kapali && ustunde && "shadow-soft",
          )}
        >
          <div
            className={cn(
              // Üst çubukla aynı 56px: menü başlığı ile sayfa başlığı aynı
              // yatay hatta oturur.
              "flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10",
              dar ? "justify-center px-2" : "px-4",
            )}
          >
            {/* Dar menüde yalnız işaret (üçgen), genişte kelime işareti;
                ikisi birden hem sıkışır hem de markayı iki kez söyler. */}
            {dar ? (
              <MamaAuraIsaret boyut={28} />
            ) : (
              <MamaAuraYazi zemin="koyu" yukseklik={17} altAd="Paket" />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SidebarNav kapali={dar} />
          </div>

          <div
            className={cn(
              "shrink-0 border-t border-white/10 p-3 pb-safe",
              dar && "p-2",
            )}
          >
            <button
              type="button"
              onClick={() => setMenuDurum(kapali ? "acik" : "kapali")}
              title={kapali ? "Menüyü açık tut" : "Menüyü daralt"}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-[--radius-kontrol] py-2.5 text-caption font-medium",
                "text-ink-foreground/70 transition-[background-color,color,transform] duration-dokunma ease-out",
                "active:scale-[0.97]",
                "[@media(hover:hover)and(pointer:fine)]:hover:bg-ink-aktif [@media(hover:hover)and(pointer:fine)]:hover:text-ink-foreground",
                dar ? "justify-center px-0" : "px-3",
              )}
            >
              {kapali ? (
                <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {dar ? (
                <span className="sr-only">Menüyü açık tut</span>
              ) : kapali ? (
                "Menüyü açık tut"
              ) : (
                "Menüyü daralt"
              )}
            </button>
          </div>
        </aside>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col transition-[padding] duration-yuzey ease-out",
            kapali ? "md:pl-[4.5rem]" : "md:pl-60",
          )}
        >
          {topbar}
          <main className="flex flex-1 flex-col overflow-x-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 md:pb-10 lg:px-8">
            <PageTransition>
              <div className="mx-auto w-full max-w-[90rem]">{children}</div>
            </PageTransition>
            {/* Sayfa geçişinin DIŞINDA: alt bilgi her sayfada aynı, geçişle
                birlikte kayıp yeniden belirmesin. `mt-auto` kısa sayfalarda
                alta yaslar. */}
            <PanelAltBilgi className="mx-auto mt-auto w-full max-w-[90rem] pt-10" />
          </main>
        </div>

        <MobilTabBar />
      </div>
    </MobilMenuSaglayici>
  );
}
