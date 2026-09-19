"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { aralikKaydet } from "@/server/actions/entegrasyonlar";

/** Seçenekler dakika cinsinden; şemadaki 0.5..60 sınırı içinde kalır. */
const SECENEKLER = [0.5, 1, 2, 5, 10, 15, 30, 60] as const;

function etiket(dk: number): string {
  return dk < 1 ? `${Math.round(dk * 60)} saniye` : `${dk} dakika`;
}

/**
 * Otomatik senkron aralığı.
 *
 * KAYDET DÜĞMESİ YOK: tek değerli bir ayarda "seç + kaydet" iki adımdır ve
 * kullanıcı ikinci adımı unutunca ayar sessizce eski kalır. Seçim anında
 * kaydedilir, sonuç yanında tek satırla söylenir.
 */
export function AralikAyari({ mevcut }: { mevcut: number }) {
  const [deger, setDeger] = useState(String(mevcut));
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
      <h2 className="text-title-3">Otomatik senkron aralığı</h2>
      <p className="mt-1 text-footnote text-muted-foreground">
        Yeni siparişler bu sıklıkta pazaryerlerinden çekilir (en sık 30 saniye).
        Eski siparişlerin durumu ayrıca 15 dakikada bir son 7 gün taranarak
        güncellenir. Çok sık çekmek pazaryerinin hız sınırına takılabilir.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Select
            aria-label="Senkron aralığı"
            value={deger}
            disabled={bekliyor}
            onChange={(olay) => {
              const yeni = olay.target.value;
              setDeger(yeni);
              setMesaj(null);
              basla(async () => {
                const cevap = await aralikKaydet(Number(yeni));
                setMesaj(cevap.mesaj ?? null);
              });
            }}
          >
            {SECENEKLER.map((d) => (
              <option key={d} value={d}>
                {etiket(d)}
              </option>
            ))}
          </Select>
        </div>
        {mesaj && (
          <p role="status" className="text-footnote text-success">
            {mesaj}
          </p>
        )}
      </div>
    </div>
  );
}
