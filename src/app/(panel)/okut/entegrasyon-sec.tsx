"use client";

import { Select } from "@/components/ui/select";
import type { EntegrasyonSecenegi } from "@/lib/db/repos/okut-siparis";

/** "Manuel" seçimi: paket bir mağazaya değil, elle okutmaya yazılır. */
export const MANUEL = "";

/**
 * MAĞAZA SEÇİCİ - okutulan paketin hangi mağazaya yazılacağı.
 *
 * Yalnız ETİKETTİR: siparişin kendisi bulunduğunda entegrasyon adı zaten
 * siparişten gelir (bkz. `okutmaKaydet`); bu seçim, siparişi bulunamayan
 * paketlerin hangi mağazanın kutusundan çıktığını kaydetmeye yarar.
 *
 * `data-odak-serbest`: burada yapılan tıklama barkod alanının odağını geri
 * çalmaz, yoksa açılır liste seçilemeden kapanırdı.
 */
export function EntegrasyonSec({
  secenekler,
  deger,
  onDeger,
}: {
  secenekler: EntegrasyonSecenegi[];
  deger: string;
  onDeger: (ad: string) => void;
}) {
  if (secenekler.length === 0) return null;

  return (
    <div data-odak-serbest className="min-w-0 sm:w-64">
      <label
        htmlFor="entegrasyon-secici"
        className="text-overline text-muted-foreground"
      >
        Mağaza
      </label>
      <Select
        id="entegrasyon-secici"
        value={deger}
        onChange={(e) => onDeger(e.target.value)}
        className="mt-1.5"
      >
        <option value={MANUEL}>Manuel</option>
        {secenekler.map((s) => (
          <option key={s.id} value={s.ad}>
            {s.ad}
          </option>
        ))}
      </Select>
    </div>
  );
}
