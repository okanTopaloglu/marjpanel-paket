"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * localStorage destekli kalıcı durum: kullanıcı sayfadan çıkıp dönse de
 * (örn. ürüne girip geri gelince) filtre seçimi korunur; kullanıcı
 * rozetteki çarpıyla kapatana kadar kalır.
 *
 * İlk boyamada varsayılan değer kullanılır (SSR ile uyum); kayıtlı değer
 * montajdan hemen sonra yüklenir.
 */
export function useKaliciDurum<T extends string>(
  anahtar: string,
  varsayilan: T,
): [T, (v: T) => void] {
  const [deger, setDeger] = useState<T>(varsayilan);

  useEffect(() => {
    try {
      const ham = localStorage.getItem(anahtar);
      if (ham != null) setDeger(JSON.parse(ham) as T);
    } catch {
      // localStorage kapalı (özel mod vb.) → filtre yalnız oturumluk olur.
    }
  }, [anahtar]);

  const guncelle = (v: T) => {
    setDeger(v);
    try {
      if (v === varsayilan) localStorage.removeItem(anahtar);
      else localStorage.setItem(anahtar, JSON.stringify(v));
    } catch {
      // yazamazsak da ekran durumu çalışmaya devam eder
    }
  };
  return [deger, guncelle];
}

export interface FiltreRozeti {
  etiket: string;
  temizle: () => void;
}

/** Aktif filtreleri üstte rozet olarak gösterir; çarpıyla tek tek kapatılır. */
export function AktifFiltreRozetleri({ ogeler }: { ogeler: FiltreRozeti[] }) {
  if (ogeler.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Aktif filtre:</span>
      {ogeler.map((o) => (
        <span
          key={o.etiket}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pl-3 pr-1.5 text-xs font-medium text-primary"
        >
          {o.etiket}
          <button
            type="button"
            onClick={o.temizle}
            aria-label={`${o.etiket} filtresini kaldır`}
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full hover:bg-primary/15"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <span className="text-[11px] text-muted-foreground">
        Sayfadan çıksanız da korunur; çarpıyla kapatın.
      </span>
    </div>
  );
}
