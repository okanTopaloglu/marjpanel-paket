import type { SenkronEntegrasyonu } from "@/lib/db/repos/entegrasyonlar";
import { amazonSaglayicisi } from "./amazon/saglayici";
import type { FetchImpl } from "./http";
import { PAZARYERLERI } from "./kayit";
import type { Kimlik } from "./kimlik";
import type { PazaryeriSaglayici, Platform } from "./tipler";
import { hepsiburadaSaglayicisi } from "./hepsiburada/saglayici";
import { idefixSaglayicisi } from "./idefix/saglayici";
import { n11Saglayicisi } from "./n11/saglayici";
import { pazaramaSaglayicisi } from "./pazarama/saglayici";
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
    case "n11":
      return n11Saglayicisi(kimlik, { ayarlar: sec.ayarlar, fetchImpl: sec.fetchImpl });
    case "hepsiburada":
      return hepsiburadaSaglayicisi(kimlik, { ayarlar: sec.ayarlar, fetchImpl: sec.fetchImpl });
    case "idefix":
      return idefixSaglayicisi(kimlik, { ayarlar: sec.ayarlar, fetchImpl: sec.fetchImpl });
    case "pazarama":
      return pazaramaSaglayicisi(kimlik, { ayarlar: sec.ayarlar, fetchImpl: sec.fetchImpl });
    case "amazon":
      return amazonSaglayicisi(kimlik, { ayarlar: sec.ayarlar, fetchImpl: sec.fetchImpl });
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
