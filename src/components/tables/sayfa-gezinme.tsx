"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Ortak sayfa gezinmesi: Önceki/Sonraki + düzenlenebilir sayfa numarası
 * ("Sayfa 12/31"daki 12 doğrudan yazılabilir). Tek sayfa varsa hiç çizilmez.
 * Büyük listelerde DOM'u küçük tutmanın (donma önleminin) standart parçası —
 * rakip tablosundan çıkarıldı, sipariş listesiyle ortak kullanılır.
 */
export function SayfaGezinme({
  sayfa,
  sayfaSayisi,
  onSayfa,
}: {
  sayfa: number;
  sayfaSayisi: number;
  onSayfa: (n: number) => void;
}) {
  const [deger, setDeger] = useState(String(sayfa + 1));
  useEffect(() => setDeger(String(sayfa + 1)), [sayfa]);
  const uygula = () => {
    const n = Number(deger);
    if (Number.isInteger(n) && n >= 1) onSayfa(Math.min(n, sayfaSayisi) - 1);
    else setDeger(String(sayfa + 1));
  };
  if (sayfaSayisi <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSayfa(sayfa - 1)}
        disabled={sayfa === 0}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Önceki
      </Button>
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Sayfa
        <Input
          value={deger}
          onChange={(e) => setDeger(e.target.value)}
          onBlur={uygula}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              uygula();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDeger(String(sayfa + 1));
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          type="number"
          min={1}
          max={sayfaSayisi}
          aria-label="Sayfa numarası"
          className="h-8 w-16 px-1 text-center"
        />
        / {sayfaSayisi}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSayfa(sayfa + 1)}
        disabled={sayfa >= sayfaSayisi - 1}
      >
        Sonraki
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
