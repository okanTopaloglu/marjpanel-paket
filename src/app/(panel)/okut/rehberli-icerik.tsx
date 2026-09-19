"use client";

import { Package } from "lucide-react";
import type { OkutmaKalemi } from "@/lib/okut/sonuc";

/**
 * SİPARİŞ İÇERİĞİ - rehberli okutmanın ve toplama modunun ortak kartı
 * (PartnerSys `OrderContentCard` portu).
 *
 * Paketleyici kutuya ne koyacağını GÖRSELDEN anlar; ad ikinci sıradadır.
 * Adet rozeti 1'den büyükse dikkat çeker: en sık hata "iki adetlik siparişe
 * tek ürün koymak"tır.
 *
 * Büyük önizleme/hover yok: depoda fare yok, ekran uzakta. Görsel zaten
 * satırda okunur boyutta durur.
 */
export function RehberliIcerik({
  kalemler,
  siparisNo,
  baslik = "Sipariş içeriği",
}: {
  kalemler: OkutmaKalemi[];
  siparisNo?: string | null;
  baslik?: string;
}) {
  const toplamAdet = kalemler.reduce((t, k) => t + (k.adet || 1), 0);

  return (
    <div className="rounded-[--radius] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="min-w-0 truncate text-title-3">
          {baslik}
          {siparisNo && (
            <span className="tabular ml-2 text-footnote text-muted-foreground">
              {siparisNo}
            </span>
          )}
        </h2>
        <span className="tabular shrink-0 text-footnote text-muted-foreground">
          {toplamAdet} adet / {kalemler.length} kalem
        </span>
      </div>

      {kalemler.length === 0 ? (
        <p className="px-4 py-6 text-center text-footnote text-muted-foreground">
          Bu siparişin satırları okunamadı.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {kalemler.map((k, i) => (
            <li
              key={`${k.barkod}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="relative shrink-0">
                {k.gorselUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pazaryeri görseli; next/image optimizasyonu gereksiz.
                  <img
                    src={k.gorselUrl}
                    alt=""
                    className="h-14 w-14 rounded-[--radius-kontrol] border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-[--radius-kontrol] border border-border bg-muted text-muted-foreground">
                    <Package className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}
                <span
                  className={`tabular absolute -right-1.5 -top-1.5 min-w-[22px] rounded-full border px-1 text-center text-[11px] font-semibold leading-[18px] ${
                    (k.adet || 1) > 1
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {k.adet || 1}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-callout text-foreground">
                  {k.urunAdi}
                </p>
                <p className="tabular text-caption text-muted-foreground">
                  {k.barkod}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
