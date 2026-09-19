"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { sevkKesimSaatiKaydet } from "@/server/actions/sirket-ayarlari";

/**
 * Sevk kesim saati (yalnız yönetici). Kaydet düğmesi yok: seçim anında
 * kaydedilir (bkz. entegrasyonlar/aralik-ayari).
 */
export function SevkKesimAyari({ mevcut }: { mevcut: number }) {
  const [deger, setDeger] = useState(String(mevcut));
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sevk kesim saati</CardTitle>
        <CardDescription>
          Bu saate kadar gelen siparişler aynı gün kargoya verilmelidir. Ana ekrandaki
          “Kargoya verilmesi gereken” sayacı ve siparişlerdeki “Sevk gecikmiş” sekmesi bu eşiğe bakar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <div className="w-36">
          <Select
            aria-label="Sevk kesim saati"
            value={deger}
            disabled={bekliyor}
            onChange={(olay) => {
              const yeni = olay.target.value;
              setDeger(yeni);
              setMesaj(null);
              basla(async () => {
                const cevap = await sevkKesimSaatiKaydet(Number(yeni));
                setMesaj({ ok: cevap.ok, metin: cevap.mesaj ?? "" });
              });
            }}
          >
            {Array.from({ length: 24 }, (_, s) => (
              <option key={s} value={s}>
                {String(s).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </div>
        {mesaj && (
          <p role="status" className={mesaj.ok ? "text-footnote text-success" : "text-footnote text-destructive"}>
            {mesaj.metin}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
