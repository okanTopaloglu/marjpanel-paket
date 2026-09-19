"use client";

import { CheckCircle2, CircleAlert, CircleX, History } from "lucide-react";
import { BosDurum } from "@/components/panel/bos-durum";
import { Rozet } from "@/components/ui/rozet";
import { saat } from "@/lib/format/tarih";
import type { OkutmaSatiriGorunum } from "./tipler";

/**
 * SON OKUTMALAR - "az önce ne okuttum" sorusunun cevabı.
 *
 * Liste BELLEKTE yaşar: sunucudan yalnız açılışta gelir, sonrası her
 * okutmanın kendi cevabıyla büyür. Yoklama yok - sıcak yolda fazladan tek
 * bir istek bile istemiyoruz.
 */

const IKONLAR = {
  basari: CheckCircle2,
  uyari: CircleAlert,
  hata: CircleX,
} as const;

const TONLAR = {
  basari: "text-success",
  uyari: "text-warning",
  hata: "text-destructive",
} as const;

export function SonOkutmalar({
  satirlar,
}: {
  satirlar: OkutmaSatiriGorunum[];
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-title-3">Son okutmalar</h2>
        <span className="tabular text-footnote text-muted-foreground">
          {satirlar.length}
        </span>
      </div>

      {satirlar.length === 0 ? (
        <BosDurum
          ikon={History}
          baslik="Henüz okutma yok"
          aciklama="Okuttuğunuz paketler buraya anında düşer; en son okutulan en üstte durur."
        />
      ) : (
        <ul className="divide-y divide-border">
          {satirlar.map((s) => {
            const Ikon = IKONLAR[s.ton];
            return (
              <li
                key={s.anahtar}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <Ikon
                  className={`h-4 w-4 shrink-0 ${TONLAR[s.ton]}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="tabular truncate text-callout font-semibold text-foreground">
                    {s.barkod}
                  </p>
                  <p className="truncate text-caption text-muted-foreground">
                    {s.etiket}
                  </p>
                </div>

                {/* Dar ekranda yalnız kargo rozeti kalır: iki rozet + saat 390px'te
                    satırı taşırıp sayfaya yatay kaydırma veriyordu. */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {s.kaynak && (
                    <Rozet className="hidden sm:inline-flex">{s.kaynak}</Rozet>
                  )}
                  {s.kargoFirmasi && s.kargoFirmasi !== s.kaynak && (
                    <Rozet ton="bilgi" className="max-w-[9rem] truncate">
                      {s.kargoFirmasi}
                    </Rozet>
                  )}
                  <span className="tabular w-11 text-right text-caption text-muted-foreground">
                    {saat(s.zaman)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
