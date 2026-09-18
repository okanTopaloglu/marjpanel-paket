import { createHash, timingSafeEqual } from "node:crypto";

/**
 * JETON KARŞILAŞTIRMA — YALNIZ SUNUCU (`node:crypto`).
 *
 * İstemci bileşenlerinden ithal EDİLMEZ: webpack `node:crypto`yu tarayıcı
 * paketine sürüklemeye çalışır ve derleme kırılır.
 */

/**
 * İki gizli metni SABİT ZAMANDA karşılaştırır.
 *
 * `timingSafeEqual` farklı UZUNLUKTAKİ tamponlarda hata fırlatır; uzunluğu
 * önceden kontrol etmek de "ilk karakter tuttu mu" sızıntısının uzunluk
 * sürümüdür. Bu yüzden iki taraf da önce SHA-256'dan geçirilir: sonuç her
 * zaman 32 bayttır, karşılaştırma her zaman aynı sürer ve girdinin uzunluğu
 * çıktıdan okunamaz.
 *
 * Boş/eksik değer HER ZAMAN false döner — "jeton tanımsız" ile "jeton yanlış"
 * aynı kapıya çıkmalı.
 */
export function jetonEsitMi(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const x = createHash("sha256").update(a, "utf8").digest();
  const y = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(x, y);
}
