"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PackageCheck, Truck } from "lucide-react";
import { Avatar } from "@/components/panel/avatar";
import { StatKarti } from "@/components/panel/stat-karti";
import type { BugunOzeti } from "@/lib/db/repos/paketler";
import type { BekleyenSayilari } from "@/lib/db/repos/okut-siparis";

/**
 * VARDİYA TABLOSU - bugün kim kaç paket okuttu + kargoya verilmeyi bekleyen
 * sipariş sayısı.
 *
 * 5 saniyede bir `/api/okut/ozet` yoklanır: aynı depoda birkaç kişi paralel
 * okutur, herkes ortak sayıyı görsün diye. Yoklama sekme GÖRÜNÜR DEĞİLKEN
 * DURUR - arka planda açık kalan bir vardiya ekranı sunucuyu boşuna
 * yormasın, telefonun pilini yakmasın.
 *
 * Başlangıç verisi sunucudan gelir (`page.tsx`): ilk boyamada boş kutu ya da
 * iskelet görünmez, sayılar zaten yerindedir.
 */

const YOKLAMA_MS = 5000;

interface OzetCevabi {
  bugun: BugunOzeti;
  bekleyen: BekleyenSayilari;
  aktifEntegrasyon: boolean;
}

export function LiderTablosu({
  baslangicBugun,
  baslangicBekleyen,
  seciliEntegrasyon,
}: {
  baslangicBugun: BugunOzeti;
  baslangicBekleyen: BekleyenSayilari;
  /** Seçili mağaza - bekleyen sayacı o mağazaya daralır. */
  seciliEntegrasyon: string;
}) {
  const [bugun, setBugun] = useState(baslangicBugun);
  const [bekleyen, setBekleyen] = useState(baslangicBekleyen);
  const surenIstek = useRef(false);

  const yokla = useCallback(async () => {
    if (surenIstek.current) return;
    surenIstek.current = true;
    try {
      const cevap = await fetch("/api/okut/ozet", { cache: "no-store" });
      if (!cevap.ok) return;
      const veri = (await cevap.json()) as OzetCevabi;
      setBugun(veri.bugun);
      setBekleyen(veri.bekleyen);
    } catch {
      // Ağ koptu - bir sonraki turda düzelir, ekran eski sayıyı gösterir.
    } finally {
      surenIstek.current = false;
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
    const gorunurluk = () =>
      document.visibilityState === "visible" ? basla() : dur();

    gorunurluk();
    document.addEventListener("visibilitychange", gorunurluk);
    return () => {
      dur();
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [yokla]);

  const magazaBekleyen = seciliEntegrasyon
    ? (bekleyen.entegrasyonBazinda.find(
        (e) => e.ad.trim().toLowerCase() === seciliEntegrasyon.trim().toLowerCase(),
      )?.adet ?? 0)
    : bekleyen.toplam;

  const enYuksek = bugun.kullanicilar[0]?.adet ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatKarti
          etiket="Bugün okutulan"
          deger={bugun.toplam}
          dipnot={`${bugun.kullanicilar.length} kişi okutuyor`}
          ikon={PackageCheck}
        />
        <StatKarti
          etiket="Kargo bekleyen"
          deger={magazaBekleyen}
          dipnot={
            seciliEntegrasyon
              ? seciliEntegrasyon
              : `Tüm mağazalar - ${bekleyen.entegrasyonBazinda.length} kaynak`
          }
          ikon={Truck}
        />
      </div>

      <div className="rounded-[--radius] border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-title-3">Bugün vardiya</h2>
          <p className="text-footnote text-muted-foreground">
            Sayılar her 5 saniyede bir tazelenir.
          </p>
        </div>

        {bugun.kullanicilar.length === 0 ? (
          <p className="px-4 py-6 text-center text-footnote text-muted-foreground">
            Bugün henüz paket okutulmadı.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {bugun.kullanicilar.map((k) => (
              <li
                key={k.kullaniciId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <Avatar ad={k.ad} profilGorsel={k.profilGorsel} boyut="md" />
                <span className="min-w-0 flex-1 truncate text-callout text-foreground">
                  {k.ad}
                </span>
                <span className="tabular text-headline text-foreground">
                  {k.adet}
                </span>
                {/* İnce oran çubuğu: en çok okutanın payına göre. */}
                <span
                  aria-hidden="true"
                  className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${enYuksek > 0 ? Math.round((k.adet / enYuksek) * 100) : 0}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
