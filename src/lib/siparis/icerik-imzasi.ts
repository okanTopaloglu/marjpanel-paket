/**
 * İçerik imzası: siparişin satırlarını `barkod:adet|barkod:adet` biçiminde,
 * barkoda göre sıralı tek metne indirger. Aynı ürün kombinasyonuna sahip
 * siparişler aynı imzayı alır; toplama modu bunları birlikte atar.
 * Upsert anında hesaplanıp `icerik_imzasi` sütununa yazılır (jsonb alt
 * sorgusu yerine indeksli sütun).
 */
import { normalZarf } from "@/lib/pazaryeri/normal-veri";

export interface SiparisKalemi {
  barkod: string;
  urunAdi: string;
  adet: number;
}

/**
 * Kalemler: ÖNCE sağlayıcının yazdığı `_normal` zarfı, yoksa Trendyol alan
 * adları (eski satırlar). Zarf tanımı `lib/pazaryeri/normal-veri`.
 */
export function kalemleriCikar(hamVeri: unknown): SiparisKalemi[] {
  const zarf = normalZarf(hamVeri);
  if (zarf) {
    return zarf.kalemler.map((k) => ({ barkod: k.barkod, urunAdi: k.urunAdi, adet: k.adet }));
  }
  const ham = (hamVeri ?? {}) as Record<string, unknown>;
  const satirlar = Array.isArray(ham.lines)
    ? (ham.lines as Record<string, unknown>[])
    : [];
  return satirlar.map((l) => ({
    barkod: String(l.barcode ?? l.productCode ?? ""),
    urunAdi: String(l.productName ?? "-"),
    adet: typeof l.quantity === "number" && l.quantity > 0 ? l.quantity : 1,
  }));
}

export function icerikImzasi(kalemler: SiparisKalemi[]): string | null {
  const dolu = kalemler.filter((k) => k.barkod);
  if (!dolu.length) return null;
  return dolu
    .map((k) => `${k.barkod}:${k.adet}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join("|");
}

export function hamVeridenImza(hamVeri: unknown): string | null {
  return icerikImzasi(kalemleriCikar(hamVeri));
}
