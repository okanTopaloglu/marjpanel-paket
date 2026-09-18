"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  ShoppingCart,
  Box,
  Plug,
  Users,
  Truck,
  Building2,
  Share2,
  FileText,
  Mail,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useOturum } from "@/components/panel/oturum-saglayici";
import type { OturumOzeti } from "@/lib/auth/kapsam";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string;
}

interface NavGrup {
  baslik: string;
  items: NavItem[];
}

/**
 * Menü, içeriğine göre adlandırılmış gruplara ayrıldı (Apple: "isimler
 * kapsayıcı değil, içeriği anlatmalı"). Gruplama yön bulmayı hızlandırır —
 * her ekran "neredeyim / nereye gidebilirim" sorusuna cevap verir.
 *
 * Gruplar/maddeler oturuma göre SÜZÜLÜR (`gruplariOlustur`): "Sipariş" ve
 * "Yönetim" yalnız admin+, "Şirketler" yalnız super_admin, "Uygulamalar"
 * içindeki her madde kendi özellik bayrağı açıkken görünür.
 */
function gruplariOlustur(ozet: OturumOzeti): NavGrup[] {
  const admin = ozet.rol === "admin" || ozet.rol === "super_admin";
  const super_ = ozet.rol === "super_admin";

  const gruplar: NavGrup[] = [
    {
      baslik: "Genel",
      items: [
        { href: "/", label: "Özet", icon: LayoutDashboard },
        { href: "/okut", label: "Paket Okut", icon: ScanBarcode },
        { href: "/paketler", label: "Paketler", icon: Package },
      ],
    },
  ];

  if (admin) {
    gruplar.push({
      baslik: "Sipariş",
      items: [
        { href: "/siparisler", label: "Siparişler", icon: ShoppingCart },
        { href: "/urunler", label: "Ürünler", icon: Box },
        { href: "/entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
      ],
    });

    const yonetimItems: NavItem[] = [
      { href: "/kullanicilar", label: "Kullanıcılar", icon: Users },
      { href: "/barkod-kurallari", label: "Barkod Kuralları", icon: Truck },
    ];
    if (super_) {
      yonetimItems.push({ href: "/sirketler", label: "Şirketler", icon: Building2 });
    }
    gruplar.push({ baslik: "Yönetim", items: yonetimItems });
  }

  const uygulamaItems: NavItem[] = [];
  if (ozet.ozellikler.faturaPaylas) {
    uygulamaItems.push({
      href: "/uygulamalar/fatura-paylas",
      label: "Fatura Paylaş",
      icon: Share2,
    });
  }
  if (ozet.ozellikler.faturaKesim) {
    uygulamaItems.push({
      href: "/uygulamalar/fatura-kesim",
      label: "Fatura Kesim",
      icon: FileText,
    });
  }
  if (ozet.ozellikler.mail) {
    uygulamaItems.push({ href: "/uygulamalar/mail", label: "Mail", icon: Mail });
  }
  if (uygulamaItems.length > 0) {
    gruplar.push({ baslik: "Uygulamalar", items: uygulamaItems });
  }

  gruplar.push({
    baslik: "Hesap",
    items: [{ href: "/ayarlar", label: "Ayarlar", icon: Settings }],
  });

  return gruplar;
}

export function navAktifMi(pathname: string, item: NavItem): boolean {
  return item.match ? pathname.startsWith(item.match) : pathname === item.href;
}

export function SidebarNav({
  kapali = false,
  onGit,
}: {
  kapali?: boolean;
  onGit?: () => void;
}) {
  const pathname = usePathname();
  const ozet = useOturum();
  const gruplar = gruplariOlustur(ozet);

  return (
    <nav
      className={cn("flex flex-col gap-5 px-3 py-4", kapali && "px-2")}
      aria-label="Ana menü"
    >
      {gruplar.map((grup) => (
        <div key={grup.baslik} className="flex flex-col gap-0.5">
          {!kapali && (
            // Grup başlığı mürekkep zeminde: ayrım opaklıkla değil BOYUT ve
            // HARF ARALIĞIYLA kurulur (text-overline zaten öyle). Opaklık
            // %60'ın altına inince 11px büyük harf metin okunamaz oluyordu.
            <div className="px-3 pb-1.5 text-overline text-ink-foreground/60">
              {grup.baslik}
            </div>
          )}
          {kapali && (
            <div
              aria-hidden="true"
              className="mx-auto mb-1.5 h-px w-6 bg-ink-foreground/15 first:hidden"
            />
          )}
          {grup.items.map((item) => {
            const { href, label, icon: Icon } = item;
            const aktif = navAktifMi(pathname, item);
            return (
              <Link
                key={href}
                href={href}
                onClick={onGit}
                aria-current={aktif ? "page" : undefined}
                title={kapali ? label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[--radius-kontrol] text-callout font-medium",
                  // `all` yok: yalnız boyanan iki özellik + basış ölçeği.
                  "transition-[background-color,color] duration-gecis ease-out",
                  "active:scale-[0.97]",
                  // Dokunma hedefi tabanı 44px — aynı bileşen mobil
                  // çekmecede de kullanılıyor.
                  "min-h-[2.75rem]",
                  kapali ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                  aktif
                    ? "bg-ink-aktif text-ink-foreground"
                    : "text-ink-foreground/70 [@media(hover:hover)and(pointer:fine)]:hover:bg-ink-aktif/60 [@media(hover:hover)and(pointer:fine)]:hover:text-ink-foreground",
                )}
              >
                {/* Aktif göstergesi: solda 3px nane çubuk. Yalnız opaklık +
                    ölçek canlandırılır — ikisi de kompozitör özelliği. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full",
                    "bg-[hsl(var(--vurgu-parlak))]",
                    "origin-left transition-[opacity,transform] duration-gecis ease-out",
                    aktif ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
                    kapali && "left-[-6px]",
                  )}
                />
                <span className="relative flex shrink-0 items-center justify-center">
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      aktif && "text-[hsl(var(--vurgu-parlak))]",
                    )}
                    aria-hidden="true"
                  />
                </span>
                {kapali ? (
                  <span className="sr-only">{label}</span>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
