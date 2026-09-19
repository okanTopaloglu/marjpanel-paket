import type { z } from "zod";

/**
 * Zod hatalarını forma ALAN BAZLI dağıtır (`kayit.ts`'teki yerel yardımcının
 * paylaşılan sürümü). Bir alanda birden fazla sorun varsa YALNIZ ilki
 * gösterilir — form tek satırda tek hata gösterir, alt alta yığılmaz.
 */
export function alanHatalari(hata: z.ZodError): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path[0];
    if (typeof alan === "string" && !cikti[alan]) cikti[alan] = sorun.message;
  }
  return cikti;
}
