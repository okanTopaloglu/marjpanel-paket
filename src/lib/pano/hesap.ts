/**
 * Pano sayı yardımcıları - saf, test edilebilir, veritabanından bağımsız.
 */

/**
 * İki dönemin yüzde değişimi, tek ondalık.
 *
 * TABAN SIFIRSA 0 DÖNER: "geçen hafta 0, bu hafta 40" için sonsuz büyüme
 * yazmak bir bilgi değil, gürültüdür (PartnerSys de aynı kararı veriyordu).
 */
export function buyumeYuzdesi(sonraki: number, onceki: number): number {
  if (onceki <= 0) return 0;
  return Math.round(((sonraki - onceki) / onceki) * 1000) / 10;
}

/**
 * Isı haritası hücresinin opaklığı (0-1).
 *
 * KAREKÖK ÖLÇEĞİ: doğrusal ölçekte tek bir yoğun saat (ör. 17:00) diğer
 * bütün hücreleri neredeyse görünmez yapıyordu. Karekök, düşük değerleri
 * yukarı çeker ve haritada akşam yoğunluğu kadar sabah kıpırtısı da okunur.
 * Dolu hücrenin tabanı 0,12 - "az ama var" ile "hiç yok" ayrılsın.
 */
export function isiYogunlugu(adet: number, azami: number): number {
  if (adet <= 0 || azami <= 0) return 0;
  const oran = Math.min(1, adet / azami);
  return 0.12 + 0.88 * Math.sqrt(oran);
}

/** Bar genişliği yüzdesi (0-100); en büyük değer tam genişlik olur. */
export function payYuzdesi(adet: number, azami: number): number {
  if (adet <= 0 || azami <= 0) return 0;
  return Math.max(2, Math.round((adet / azami) * 100));
}
