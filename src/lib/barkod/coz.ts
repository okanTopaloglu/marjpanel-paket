/**
 * Barkod → kaynak/kargo çözümü. Saf fonksiyon: kural listesi dışarıdan gelir
 * (repos/barkod-kurallari: global + şirket kuralları). PartnerSys'teki
 * sabit `startsWith` zinciri yerine DB'den beslenen, test edilebilir eşleme.
 *
 * Sıra: küçük `oncelik` önce; eşit öncelikte UZUN önek kazanır (72700 > 726);
 * şirket kuralı aynı önekte global kuralı ezer (çağıran listeyi öyle kurar).
 */
import { BILINMEYEN } from "./varsayilan-kurallar";

export interface EslesmeKurali {
  barkodOneki: string;
  kaynak: string;
  kargoFirmasi: string;
  oncelik: number;
  aktif?: boolean;
  /** NULL = global. Şirket kuralı öncelik eşitliğinde global kuralı ezer. */
  sirketId?: string | null;
}

export interface BarkodBilgisi {
  kaynak: string;
  kargoFirmasi: string;
  /** Kaynak ya da kargo çözülemedi; kayıt yine yapılır, arayüz uyarır. */
  bilinmiyor: boolean;
}

export function barkodTemizle(barkod: string): string {
  return barkod.trim().toUpperCase();
}

export function kurallariSirala<T extends EslesmeKurali>(kurallar: T[]): T[] {
  return [...kurallar]
    .filter((k) => k.aktif !== false && k.barkodOneki.length > 0)
    .sort((a, b) => {
      if (a.oncelik !== b.oncelik) return a.oncelik - b.oncelik;
      if (a.barkodOneki.length !== b.barkodOneki.length)
        return b.barkodOneki.length - a.barkodOneki.length;
      // Şirket kuralı globalden önce.
      const as = a.sirketId ? 0 : 1;
      const bs = b.sirketId ? 0 : 1;
      return as - bs;
    });
}

export function kuralEslestir(
  kurallar: EslesmeKurali[],
  barkod: string,
): BarkodBilgisi {
  const temiz = barkodTemizle(barkod);
  for (const k of kurallariSirala(kurallar)) {
    if (temiz.startsWith(k.barkodOneki.toUpperCase())) {
      const kaynak = k.kaynak || BILINMEYEN;
      const kargo = k.kargoFirmasi || BILINMEYEN;
      return {
        kaynak,
        kargoFirmasi: kargo,
        bilinmiyor: kaynak === BILINMEYEN || kargo === BILINMEYEN,
      };
    }
  }
  return { kaynak: BILINMEYEN, kargoFirmasi: BILINMEYEN, bilinmiyor: true };
}
