"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  ShoppingCart,
  Settings,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useMobilMenu } from "./mobile-nav";
import { useOturum } from "@/components/panel/oturum-saglayici";
import { titret } from "@/lib/motion/yay";
import { cn } from "@/lib/utils";

interface Sekme {
  href?: string;
  label: string;
  icon: LucideIcon;
  match?: string;
}

/**
 * En sık gidilen dört yer + menü.
 *
 * Dördüncü sekme role göre değişir: admin+ için "Siparişler" (depo dışı
 * kararların merkezi), çalışan için onun yerine "Ayarlar" — çalışan
 * siparişler ekranını göremez (bkz. `sidebar-nav.tsx`), boş bir sekme
 * göstermek yerine erişebileceği bir yer konur.
 */
function sekmeleriOlustur(calisanMi: boolean): Sekme[] {
  return [
    { href: "/", label: "Özet", icon: LayoutDashboard },
    { href: "/okut", label: "Okut", icon: ScanBarcode },
    { href: "/paketler", label: "Paketler", icon: Package, match: "/paketler" },
    calisanMi
      ? { href: "/ayarlar", label: "Ayarlar", icon: Settings, match: "/ayarlar" }
      : { href: "/siparisler", label: "Siparişler", icon: ShoppingCart },
    { label: "Menü", icon: Menu },
  ];
}

/**
 * Mobil alt sekme çubuğu — BEYAZ, üst çizgi. Cam/blur yok: alt çubuk
 * ekranın en alt kenarında, altından geçen içerik zaten kaydırılıp gidiyordu
 * ve her karede şeridin yeniden bulanıklaştırılması ölçülebilir kare kaybıydı.
 *
 * Güvenli alan (ana ekran çizgisi) hesaba katılır; dokunma hedefleri 44px'in
 * altına inmez.
 */
export function MobilTabBar() {
  const pathname = usePathname();
  const { ac, acikMi } = useMobilMenu();
  const { rol } = useOturum();
  const sekmeler = sekmeleriOlustur(rol === "calisan");

  return (
    <nav
      aria-label="Hızlı menü"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden",
        "px-safe pb-safe",
      )}
    >
      <ul className="flex items-stretch">
        {sekmeler.map((s) => {
          const aktif = s.href
            ? s.match
              ? pathname.startsWith(s.match)
              : pathname === s.href
            : acikMi;
          const Icon = s.icon;
          const icerik = (
            <>
              <Icon
                className={cn(
                  "h-[22px] w-[22px] shrink-0 transition-colors duration-gecis ease-out",
                  aktif
                    ? "text-[hsl(var(--vurgu-parlak))]"
                    : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  // 11px taban: alt sekme etiketi panelin en küçük metni ve
                  // 10px'te `muted-foreground` ile AA eşiğinin altına
                  // düşüyordu. Ayrım renk kadar AĞIRLIKLA da kurulur.
                  "text-[11px] leading-none tracking-[0.01em]",
                  "transition-colors duration-gecis ease-out",
                  // Aktif etiket `.vurgu` (koyulaştırılmış nane): ikon
                  // parlak tonda KALIR — o bir şekil, kontrast eşiğine tabi
                  // değil.
                  aktif ? "vurgu font-semibold" : "font-medium text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </>
          );

          const ortak = cn(
            "flex min-h-touch w-full flex-col items-center justify-center gap-1 px-1 py-2",
            "transition-transform duration-dokunma ease-out active:scale-[0.97]",
          );

          return (
            <li key={s.label} className="min-w-0 flex-1">
              {s.href ? (
                <Link
                  href={s.href}
                  aria-current={aktif ? "page" : undefined}
                  onClick={() => titret(5)}
                  className={ortak}
                >
                  {icerik}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    titret(5);
                    ac();
                  }}
                  aria-expanded={acikMi}
                  className={ortak}
                >
                  {icerik}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
