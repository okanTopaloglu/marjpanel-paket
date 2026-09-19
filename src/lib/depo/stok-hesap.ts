/**
 * STOK HESAPLARI — saf, test edilir. Sayılar SQL'den gelir (giren, çıkan,
 * son 30 gün çıkış); türetimler burada ki rapor ve kartlar aynı formülü
 * kullansın.
 */
export const DEVIR_PENCERESI_GUN = 30;
/** Bu kadar günden az kaldıysa "kritik" (rapor kırmızı satır). */
export const KRITIK_GUN = 7;
/** Bu adetten az kaldıysa hızdan bağımsız kritik. */
export const KRITIK_ADET = 5;

export interface StokSayilari {
  giren: number;
  cikan: number;
  son30Cikis: number;
}

export function kalanAdet(s: StokSayilari): number {
  return s.giren - s.cikan;
}

/** Günlük ortalama çıkış (son 30 gün). */
export function gunlukHiz(s: StokSayilari): number {
  return s.son30Cikis / DEVIR_PENCERESI_GUN;
}

/**
 * Tükenme tahmini (gün). Çıkış yoksa `null` (sonsuz); stok bittiyse 0.
 * Yukarı yuvarlanır: "3,2 gün" → 4 (dördüncü gün içinde biter).
 */
export function tukenmeGun(s: StokSayilari): number | null {
  const kalan = kalanAdet(s);
  if (kalan <= 0) return 0;
  const hiz = gunlukHiz(s);
  if (hiz <= 0) return null;
  return Math.ceil(kalan / hiz);
}

/**
 * Devir hızı (30 günlük): çıkış / ortalama stok. Ortalama stok, dönem
 * başındaki (kalan + çıkış) ile sonundaki (kalan) değerin ortalaması.
 * Ortalama sıfırsa `null`.
 */
export function devirHizi(s: StokSayilari): number | null {
  const kalan = Math.max(0, kalanAdet(s));
  const ortalama = (kalan + (kalan + s.son30Cikis)) / 2;
  if (ortalama <= 0) return null;
  return Math.round((s.son30Cikis / ortalama) * 100) / 100;
}

export type StokDurumu = "eksi" | "kritik" | "normal" | "hareketsiz";

/**
 * eksi: kabul edilenden fazla çıkmış (kabul girilmemiş ya da sayım gerekli)
 * kritik: az kaldı ya da 7 günden önce biter
 * hareketsiz: 30 gündür çıkış yok ama stok var
 */
export function stokDurumu(s: StokSayilari): StokDurumu {
  const kalan = kalanAdet(s);
  if (kalan < 0) return "eksi";
  const gun = tukenmeGun(s);
  if (kalan <= KRITIK_ADET || (gun !== null && gun <= KRITIK_GUN)) return "kritik";
  if (s.son30Cikis === 0 && kalan > 0) return "hareketsiz";
  return "normal";
}
