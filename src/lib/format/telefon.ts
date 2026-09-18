/**
 * Türkiye cep telefonu normalizasyonu. Tek kanonik format: 10 hane, başında
 * sıfır yok (5XXXXXXXXX). Kayıt ve girişte aynı fonksiyon kullanılır ki
 * unique index her zaman eşleşsin.
 */
export function telefonNormalize(girdi: string): string | null {
  if (!girdi) return null;
  let s = girdi.replace(/[\s().-]/g, "");
  if (s.startsWith("+90")) s = s.slice(3);
  else if (s.startsWith("90") && s.length === 12) s = s.slice(2);
  if (s.startsWith("0")) s = s.slice(1);
  return /^5\d{9}$/.test(s) ? s : null;
}

/** Görünüm formatı: 0532 123 45 67 (normalize edilemezse girdiyi aynen döndürür). */
export function telefonGorunum(phone: string): string {
  const t = telefonNormalize(phone);
  if (!t) return phone;
  return `0${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6, 8)} ${t.slice(8, 10)}`;
}

/**
 * Yazarken maskeleme: girilen rakamları "0XXX XXX XX XX" biçiminde diziyor,
 * en fazla 11 hane tutuyor. Girdi henüz tamamlanmamış olabilir (kullanıcı
 * yazmaya devam ediyor), bu yüzden `telefonNormalize`nin aksine geçersiz
 * bir uzunlukta da hata vermez.
 *
 * PartnerSys `phoneFormat.ts`teki `formatPhoneDisplay`in portu. Orijinalinde
 * baştaki sıfır eksikse aynı rakamları yeniden kendisine yollayan bir
 * özyineleme vardı (`return '0' + formatPhoneDisplay(digits)`) ve bu, sıfırla
 * başlamayan her girdide sonsuz döngüye giriyordu; burada sıfır tek seferde
 * eklenip özyineleme olmadan biçimleniyor.
 */
export function telefonMaske(girdi: string): string {
  const hane = girdi.replace(/\D/g, "");
  if (hane.length === 0) return "";
  const digits = hane.startsWith("0") ? hane : `0${hane}`;
  const sinirli = digits.slice(0, 11);

  if (sinirli.length <= 4) return sinirli;
  if (sinirli.length <= 7) return `${sinirli.slice(0, 4)} ${sinirli.slice(4)}`;
  if (sinirli.length <= 9) {
    return `${sinirli.slice(0, 4)} ${sinirli.slice(4, 7)} ${sinirli.slice(7)}`;
  }
  return `${sinirli.slice(0, 4)} ${sinirli.slice(4, 7)} ${sinirli.slice(7, 9)} ${sinirli.slice(9)}`;
}
