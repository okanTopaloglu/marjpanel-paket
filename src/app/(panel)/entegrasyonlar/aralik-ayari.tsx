"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { aralikKaydet } from "@/server/actions/entegrasyonlar";

/** Seçenekler dakika cinsinden; şemadaki 2..60 sınırı içinde kalır. */
const SECENEKLER = [2, 5, 10, 15, 30, 60] as const;

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
        Siparişler bu sıklıkta Trendyol&apos;dan çekilir. Sık çekmek siparişi
        erken görmenizi sağlar, çok sık çekmek pazaryerinin hız sınırına takılır.
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
                {d} dakika
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
