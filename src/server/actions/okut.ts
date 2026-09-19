"use server";

import { panelKapsami } from "@/lib/auth/yetki";
import { okutmaKaydet } from "@/lib/db/repos/paketler";
import { barkodDogrula, type OkutmaCevabi } from "@/lib/okut/sonuc";

/**
 * PAKET OKUT - okutma ekranının tek yazma kapısı.
 *
 * Neden server action: barkod saniyede birkaç kez gelir; ayrı bir API ucu
 * açmak her okutmada elle serileştirme, hata eşlemesi ve oturum kontrolü
 * demekti. Kapsam BURADA üretilir (`panelKapsami`), istemciden gelen hiçbir
 * kimlik bilgisine güvenilmez - ekran yalnız barkodu ve mağaza etiketini
 * gönderebilir.
 *
 * Dönüş İSTİSNA DEĞİL VERİDİR: mükerrer paket, iptal edilmiş sipariş ya da
 * boş barkod birer "sonuç"tur, ekran bunları perdeyle gösterir. Gerçek
 * beklenmedik hatalar (veritabanı düştü) yukarı fırlar ve Next.js hata
 * sınırına gider.
 */
export async function paketOkut(
  barkod: string,
  entegrasyonAdi?: string,
): Promise<OkutmaCevabi> {
  const kapsam = await panelKapsami();
  if (!kapsam) {
    return { ok: false, hata: "Oturumunuz sona ermiş. Yeniden giriş yapın." };
  }

  const dogrulama = barkodDogrula(barkod);
  if (!dogrulama.ok) return { ok: false, hata: dogrulama.hata };

  const temizEntegrasyon = (entegrasyonAdi ?? "").trim();
  const sonuc = await okutmaKaydet(
    kapsam,
    dogrulama.barkod,
    temizEntegrasyon || undefined,
  );

  return { ok: true, sonuc };
}
