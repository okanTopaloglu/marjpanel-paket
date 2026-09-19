"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Layers, PackageCheck, RefreshCw, Trophy, Truck } from "lucide-react";
import { Avatar } from "@/components/panel/avatar";
import { PazaryeriRozeti, Rozet } from "@/components/ui/rozet";
import { telefonGorunum } from "@/lib/format/telefon";
import type { BugunOzeti } from "@/lib/db/repos/paketler";
import type { BekleyenSayilari, EntegrasyonSecenegi } from "@/lib/db/repos/okut-siparis";
import type { KullaniciRolu, OkutmaModu } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/**
 * MAĞAZA SEÇİM EKRANI — okutmanın ikinci adımı.
 *
 * Üstte "Kargoya verilmesi gereken" (toplam + mağaza kırılımı), altta üç
 * sütun: kullanıcı kartı (bugün okuttuğu), ENTEGRASYON LİSTESİ (hangi
 * mağazadan toplanacak; Manuel/Karışık = tüm kaynaklar) ve bugünkü sıralama.
 *
 * Sayılar 5 saniyede bir `/api/okut/ozet`ten tazelenir (lider tablosuyla
 * aynı uç); sekme görünür değilken yoklama durur.
 */
const YOKLAMA_MS = 5000;
const tr = new Intl.NumberFormat("tr-TR");
const ROL: Record<KullaniciRolu, string> = { super_admin: "Süper Yönetici", admin: "Yönetici", calisan: "Çalışan" };

interface OzetCevabi {
  bugun: BugunOzeti;
  bekleyen: BekleyenSayilari;
}

export function SecimEkrani({
  mod,
  kullanici,
  entegrasyonlar,
  baslangicBugun,
  baslangicBekleyen,
}: {
  mod: OkutmaModu;
  kullanici: { kullaniciId: string; ad: string; telefon: string; rol: KullaniciRolu; profilGorsel: string | null };
  entegrasyonlar: EntegrasyonSecenegi[];
  baslangicBugun: BugunOzeti;
  baslangicBekleyen: BekleyenSayilari;
}) {
  const [bugun, setBugun] = useState(baslangicBugun);
  const [bekleyen, setBekleyen] = useState(baslangicBekleyen);
  const [yenileniyor, setYenileniyor] = useState(false);
  const surenIstek = useRef(false);

  const yokla = useCallback(async () => {
    if (surenIstek.current) return;
    surenIstek.current = true;
    setYenileniyor(true);
    try {
      const cevap = await fetch("/api/okut/ozet", { cache: "no-store" });
      if (!cevap.ok) return;
      const veri = (await cevap.json()) as OzetCevabi;
      setBugun(veri.bugun);
      setBekleyen(veri.bekleyen);
    } catch {
      // Ağ koptu - bir sonraki turda düzelir.
    } finally {
      surenIstek.current = false;
      setYenileniyor(false);
    }
  }, []);

  useEffect(() => {
    let zamanlayici: ReturnType<typeof setInterval> | null = null;
    const basla = () => {
      if (zamanlayici) return;
      void yokla();
      zamanlayici = setInterval(() => void yokla(), YOKLAMA_MS);
    };
    const dur = () => {
      if (!zamanlayici) return;
      clearInterval(zamanlayici);
      zamanlayici = null;
    };
    const gorunurluk = () => (document.visibilityState === "visible" ? basla() : dur());
    gorunurluk();
    document.addEventListener("visibilitychange", gorunurluk);
    return () => {
      dur();
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [yokla]);

  const magazaBekleyen = (ad: string) =>
    bekleyen.entegrasyonBazinda.find((e) => e.ad.trim().toLowerCase() === ad.trim().toLowerCase())?.adet ?? 0;
  const benimAdetim = bugun.kullanicilar.find((k) => k.kullaniciId === kullanici.kullaniciId)?.adet ?? 0;
  const href = (magaza: string) => `/okut?mod=${mod}&magaza=${encodeURIComponent(magaza)}`;

  return (
    <div className="space-y-4">
      {/* Kargoya verilmesi gereken */}
      <div className="flex flex-wrap items-center gap-4 rounded-[--radius] border border-warning/50 bg-warning-soft/40 p-4 sm:p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-warning text-white">
          <Truck className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-title-3 text-warning">Kargoya Verilmesi Gereken</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {bekleyen.entegrasyonBazinda.length === 0 ? (
              <span className="text-footnote text-muted-foreground">Bekleyen sipariş yok.</span>
            ) : (
              bekleyen.entegrasyonBazinda.map((e) => (
                <span key={e.ad} className="tabular inline-flex items-center gap-1 rounded-full border border-warning/40 bg-card px-2 py-0.5 text-caption font-semibold text-warning">
                  {e.ad}: {tr.format(e.adet)}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular text-display leading-none text-warning">{tr.format(bekleyen.toplam)}</span>
          <button
            type="button"
            onClick={() => void yokla()}
            aria-label="Yenile"
            className="flex h-10 w-10 items-center justify-center rounded-full text-warning hover:bg-warning/10"
          >
            <RefreshCw className={cn("h-5 w-5", yenileniyor && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,17rem)]">
        {/* Kullanıcı kartı */}
        <div className="flex flex-col items-center rounded-[--radius] border border-border bg-card p-5 text-center">
          <Avatar ad={kullanici.ad} profilGorsel={kullanici.profilGorsel} boyut="lg" />
          <div className="mt-3 text-title-3">{kullanici.ad}</div>
          <div className="tabular text-footnote text-muted-foreground">{telefonGorunum(kullanici.telefon)}</div>
          <Rozet ton="bilgi" className="mt-2">{ROL[kullanici.rol]}</Rozet>
          <div className="mt-5 w-full border-t border-border pt-5">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
              <PackageCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="mt-2 text-overline text-muted-foreground">Bugün okutulan</div>
            <div className="tabular text-display leading-none text-success">{tr.format(benimAdetim)}</div>
            <div className="text-caption text-muted-foreground">paket</div>
          </div>
        </div>

        {/* Entegrasyon listesi */}
        <div className="rounded-[--radius] border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-title-3">Entegrasyon listesi</h2>
            <p className="text-footnote text-muted-foreground">
              Toplama yapacağınız entegrasyonu seçin. Karışık okutmak için Manuel seçin.
            </p>
          </div>
          <ul className="divide-y divide-border">
            <li>
              <SecimSatiri href={href("manuel")} adet={bekleyen.toplam} baslik="Manuel / Karışık" altyazi="Tüm kaynaklar" ikon={<Layers className="h-4 w-4" aria-hidden="true" />} />
            </li>
            {[...entegrasyonlar]
              .sort((a, b) => magazaBekleyen(b.ad) - magazaBekleyen(a.ad))
              .map((e) => (
                <li key={e.id}>
                  <SecimSatiri href={href(e.ad)} adet={magazaBekleyen(e.ad)} baslik={e.ad} altyazi={<PazaryeriRozeti platform={e.platform} />} />
                </li>
              ))}
          </ul>
          {entegrasyonlar.length === 0 && (
            <p className="px-4 py-4 text-footnote text-muted-foreground">
              Bağlı mağaza yok; paketler Manuel olarak okutulur. Yönetici Entegrasyonlar sayfasından mağaza bağlayabilir.
            </p>
          )}
        </div>

        {/* Bugünkü sıralama */}
        <div className="rounded-[--radius] border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
            <h2 className="text-title-3">Bugünkü sıralama</h2>
          </div>
          {bugun.kullanicilar.length === 0 ? (
            <p className="px-4 py-6 text-center text-footnote text-muted-foreground">Bugün henüz paket okutulmadı.</p>
          ) : (
            <ol className="divide-y divide-border">
              {bugun.kullanicilar.slice(0, 8).map((k, i) => (
                <li key={k.kullaniciId} className={cn("flex items-center gap-3 px-4 py-2.5", k.kullaniciId === kullanici.kullaniciId && "bg-accent/50")}>
                  <span className={cn("tabular w-5 text-center text-footnote font-bold", i === 0 ? "text-warning" : "text-muted-foreground")}>{i + 1}</span>
                  <Avatar ad={k.ad} profilGorsel={k.profilGorsel} boyut="sm" />
                  <span className="min-w-0 flex-1 truncate text-callout">{k.ad}</span>
                  <span className="tabular text-headline text-success">{tr.format(k.adet)}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-callout font-semibold">Toplam</span>
            <span className="tabular text-headline text-warning">{tr.format(bugun.toplam)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecimSatiri({ href, adet, baslik, altyazi, ikon }: { href: string; adet: number; baslik: string; altyazi: React.ReactNode; ikon?: React.ReactNode }) {
  return (
    <Link href={href} className="press flex min-h-touch items-center gap-3 px-4 py-3 hover:bg-accent">
      <span className="tabular flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-headline">
        {tr.format(adet)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-callout font-semibold">
          {ikon}
          <span className="truncate">{baslik}</span>
        </span>
        <span className="mt-0.5 block text-caption text-muted-foreground">{altyazi}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
