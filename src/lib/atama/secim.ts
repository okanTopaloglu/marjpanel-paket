import { HEDEF_ATAMA, TEK_GRUP_ESIGI } from "./sabitler";

export interface ImzaGrubu {
  imza: string;
  adet: number;
}

/**
 * Hangi içerik grupları atanacak? Saf seçim:
 *  - Gruplar adede göre azalan sıralı gelir (DB `ORDER BY c DESC`).
 *  - En büyük grup ≥ TEK_GRUP_ESIGI ise yalnız o grup (aynı ürünü toplu toplamak
 *    en verimli iş).
 *  - Değilse gruplar sırayla eklenir; toplam HEDEF_ATAMA'ya ulaşınca durur.
 */
export function gruplariSec(gruplar: ImzaGrubu[]): string[] {
  if (!gruplar.length) return [];
  const sirali = [...gruplar].sort((a, b) => b.adet - a.adet);
  const ilk = sirali[0]!;
  if (ilk.adet >= TEK_GRUP_ESIGI) return [ilk.imza];
  const secilen: string[] = [];
  let toplam = 0;
  for (const g of sirali) {
    secilen.push(g.imza);
    toplam += g.adet;
    if (toplam >= HEDEF_ATAMA) break;
  }
  return secilen;
}

export interface ToplamaKalemi {
  barkod: string;
  urunAdi: string;
  gorselUrl: string | null;
  toplamAdet: number;
  siparisSayisi: number;
}

/** Atanan siparişlerin satırlarını barkod bazında toplulaştırır (toplama listesi). */
export function toplamaListesi(
  siparisler: Array<{ kalemler: Array<{ barkod: string; urunAdi: string; adet: number; gorselUrl?: string | null }> }>,
): ToplamaKalemi[] {
  const harita = new Map<string, ToplamaKalemi>();
  for (const s of siparisler) {
    for (const k of s.kalemler) {
      if (!k.barkod) continue;
      const mevcut = harita.get(k.barkod);
      if (mevcut) {
        mevcut.toplamAdet += k.adet;
        mevcut.siparisSayisi += 1;
      } else {
        harita.set(k.barkod, {
          barkod: k.barkod,
          urunAdi: k.urunAdi,
          gorselUrl: k.gorselUrl ?? null,
          toplamAdet: k.adet,
          siparisSayisi: 1,
        });
      }
    }
  }
  return [...harita.values()].sort((a, b) => b.toplamAdet - a.toplamAdet);
}
