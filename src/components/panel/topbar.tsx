import { LogOut } from "lucide-react";
import { cikisYap } from "@/server/actions/auth";
import { MobilMenuButonu } from "./mobile-nav";
import { MarkaYazi } from "@/components/marka/logo";
import { Avatar } from "@/components/panel/avatar";
import type { OturumOzeti } from "@/lib/auth/kapsam";
import type { KullaniciRolu } from "@/lib/db/schema";

/**
 * Üst çubuk — 56px, beyaz, ince alt çizgi.
 *
 * SAYFA BAŞLIĞI BURADA DEĞİL. Başlık içeriğin parçasıdır ve sayfada,
 * `SayfaBasligi` bileşeniyle durur.
 *
 * Kalan içerik yalnız KİMLİK ve DURUM: kullanıcı adı, rolü, şirketi, çıkış.
 * Bildirim zili yok (marjpanel'de olan `BildirimZili` bu uygulamada
 * kapsam dışı — bkz. görev tanımı).
 */
const ROL_ETIKETI: Record<KullaniciRolu, string> = {
  super_admin: "Süper yönetici",
  admin: "Yönetici",
  calisan: "Çalışan",
};

export function Topbar({ ozet }: { ozet: OturumOzeti }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card px-safe">
      <div className="flex h-14 items-center justify-between gap-3 px-4 pt-safe sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 md:hidden">
          <MobilMenuButonu />
          <MarkaYazi className="text-title-3" altAd="Paket" />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1 sm:pr-3">
            <Avatar ad={ozet.ad} profilGorsel={ozet.profilGorsel} />
            <div className="hidden leading-tight sm:block">
              <div className="max-w-[180px] truncate text-caption font-semibold text-foreground">
                {ozet.ad}
              </div>
              <div className="truncate text-overline text-muted-foreground">
                {ROL_ETIKETI[ozet.rol]} · {ozet.sirketAd}
              </div>
            </div>
          </div>

          <form action={cikisYap}>
            <button
              type="submit"
              title="Çıkış"
              className="press inline-flex h-9 min-w-touch cursor-pointer items-center justify-center gap-2 rounded-[--radius-kontrol] px-2.5 text-callout font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
