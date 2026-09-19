"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import {
  ON_AYARLAR,
  ON_AYAR_ETIKETLERI,
  aktifOnAyar,
  onAyarAraligi,
  type Aralik,
} from "@/lib/pano/aralik";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * PANO TARİH FİLTRESİ - çip şeridi + iki tarih alanı.
 *
 * Seçim URL'DE yaşar (`?baslangic=&bitis=`): sayfa sunucuda çizilir, aralık
 * değişince sorgu yeniden koşar. Bileşen kendi verisini tutmaz, dolayısıyla
 * geri düğmesi, yenileme ve paylaşılan bağlantı aynı ekranı verir.
 *
 * "BUGÜN" HESABI SUNUCUDAN GELİR (`bugun` prop'u, İstanbul günü). Tarayıcının
 * saatine bakılsaydı yurt dışındaki bir kullanıcı ya da saati kaymış bir
 * depo bilgisayarı başka bir "bugün" görürdü.
 */
export function PanoFiltre({
  aralik,
  bugun,
}: {
  aralik: Aralik;
  /** İstanbul takvim günü (`YYYY-MM-DD`) - ön ayarlar buna göre hesaplanır. */
  bugun: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const secili = aktifOnAyar(aralik, bugun);

  const uygula = (yeni: Aralik) => {
    const p = new URLSearchParams();
    p.set("baslangic", yeni.baslangic);
    p.set("bitis", yeni.bitis);
    startTransition(() => router.push(`/?${p.toString()}`));
  };

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-overline text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
            Tarih aralığı
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Hazır aralıklar">
            {ON_AYARLAR.map((onAyar) => {
              const aktif = secili === onAyar;
              return (
                <button
                  key={onAyar}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => uygula(onAyarAraligi(onAyar, bugun))}
                  className={cn(
                    "press inline-flex min-h-touch cursor-pointer items-center rounded-full border px-3.5",
                    "text-[0.8125rem] font-semibold",
                    "transition-colors duration-dokunma ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    aktif
                      ? "border-primary bg-primary text-primary-foreground"
                      : cn(
                          "border-input bg-card text-foreground",
                          "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
                        ),
                  )}
                >
                  {ON_AYAR_ETIKETLERI[onAyar]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pano-baslangic">Başlangıç</Label>
            <Input
              id="pano-baslangic"
              type="date"
              value={aralik.baslangic}
              max={aralik.bitis}
              onChange={(e) =>
                e.target.value &&
                uygula({ baslangic: e.target.value, bitis: aralik.bitis })
              }
              className="tabular w-[10.5rem]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pano-bitis">Bitiş</Label>
            <Input
              id="pano-bitis"
              type="date"
              value={aralik.bitis}
              min={aralik.baslangic}
              onChange={(e) =>
                e.target.value &&
                uygula({ baslangic: aralik.baslangic, bitis: e.target.value })
              }
              className="tabular w-[10.5rem]"
            />
          </div>
        </div>
      </div>

      {pending && (
        <span className="sr-only" role="status">
          Yükleniyor…
        </span>
      )}
    </div>
  );
}
