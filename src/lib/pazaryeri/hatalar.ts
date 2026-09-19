import type { Platform } from "./tipler";

/**
 * Pazaryeri hata sınıfları — motor TÜRE bakarak karar verir, metin ayrıştırmaz.
 *
 *  · `PazaryeriHizSiniri` (429) → yalnız o entegrasyon bırakılır ve
 *    `tekrarSaniye` kadar ertelenir; diğer satıcılar çekilmeye devam eder.
 *  · `PazaryeriKimlikHatasi` (401/403) → tekrar denemek işe yaramaz;
 *    `son_hata` yazılır, entegrasyon bir saat ertelenir, kullanıcı kartta görür.
 *  · `PazaryeriBaglantiHatasi` → ağ/zaman aşımı; bir sonraki turda yeniden.
 *  · `PazaryeriHatasi` → diğer HTTP hataları.
 */
export class PazaryeriHatasi extends Error {
  constructor(
    readonly platform: Platform,
    readonly durumKodu: number,
    readonly govde: string,
    mesaj?: string,
  ) {
    super(mesaj ?? `${platform} API ${durumKodu}: ${govde.slice(0, 200)}`);
    this.name = "PazaryeriHatasi";
  }
}

export class PazaryeriHizSiniri extends PazaryeriHatasi {
  constructor(
    platform: Platform,
    govde = "",
    /** `Retry-After` / `x-amzn-RateLimit-Limit`ten türetilir; bilinmiyorsa null. */
    readonly tekrarSaniye: number | null = null,
  ) {
    super(
      platform,
      429,
      govde,
      `${platform} hız sınırı (429). ${tekrarSaniye ? `${tekrarSaniye} sn` : "Bir süre"} sonra tekrar denenecek.`,
    );
    this.name = "PazaryeriHizSiniri";
  }
}

export class PazaryeriKimlikHatasi extends PazaryeriHatasi {
  constructor(platform: Platform, durumKodu: number, govde = "") {
    super(
      platform,
      durumKodu,
      govde,
      `API anahtarı veya kimlik bilgileri hatalı (${durumKodu}). Entegrasyon bilgilerini kontrol edin.`,
    );
    this.name = "PazaryeriKimlikHatasi";
  }
}

export class PazaryeriBaglantiHatasi extends Error {
  constructor(
    readonly platform: Platform,
    mesaj: string,
  ) {
    super(`${platform} bağlantı hatası: ${mesaj}`);
    this.name = "PazaryeriBaglantiHatasi";
  }
}

export function hataMetni(hata: unknown): string {
  return hata instanceof Error ? hata.message : String(hata);
}
