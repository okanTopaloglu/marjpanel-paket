import type { SenkronEntegrasyonu } from "@/lib/db/repos/entegrasyonlar";
import type { FetchImpl } from "./http";
import { PAZARYERLERI } from "./kayit";
import type { Kimlik } from "./kimlik";
import type { PazaryeriSaglayici, Platform } from "./tipler";
import { trendyolSaglayicisi } from "./trendyol/saglayici";

/**
 * SAĞLAYICI FABRİKASI — yalnız sunucu.
 *
 * Motor ve server action'lar pazaryeri adını bilmez; entegrasyon satırını
 * verir, sağlayıcıyı alır. Platform sağlayıcısı henüz yazılmadıysa
 * (`kayit.ts` `hazir:false`) burada açık bir hata döner; kayıt ekranı zaten
 * izin vermez ama motor eski bir satırla karşılaşırsa sessizce geçmesin.
 */
export class SaglayiciYok extends Error {
  constructor(platform: string) {
    super(`${platform} sağlayıcısı henüz hazır değil.`);
    this.name = "SaglayiciYok";
  }
}

export interface SaglayiciSecenekleri {
  ayarlar?: Record<string, unknown>;
  fetchImpl?: FetchImpl;
}

export function saglayiciKur(
  platform: Platform,
  kimlik: Kimlik,
  sec: SaglayiciSecenekleri = {},
): PazaryeriSaglayici {
  if (!PAZARYERLERI[platform]?.hazir) throw new SaglayiciYok(platform);
  switch (platform) {
    case "trendyol":
      return trendyolSaglayicisi(kimlik, { ayarlar: sec.ayarlar, fetchImpl: sec.fetchImpl });
    default:
      throw new SaglayiciYok(platform);
  }
}

export function saglayiciAl(
  e: SenkronEntegrasyonu,
  sec: SaglayiciSecenekleri = {},
): PazaryeriSaglayici {
  return saglayiciKur(e.platform, e.kimlik, { ayarlar: e.ayarlar, ...sec });
}
