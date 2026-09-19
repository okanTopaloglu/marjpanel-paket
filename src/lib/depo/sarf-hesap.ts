/**
 * SARF STOK HESABI — saf, test edilir.
 *
 * stok = alımlar + düzeltmeler + sayım farkları − norm × normdan sonraki paket
 * Sayım girişi "stoğu şu değere eşitle" demektir; kaydedilen hareket, sayılan
 * ile o anki hesaplanan stok arasındaki FARKTIR — böylece geçmiş bozulmaz.
 */
export interface SarfSayilari {
  hareketToplami: number;
  paketBasiNorm: number;
  normSonrasiPaket: number;
  kritikSeviye: number;
  birimMaliyet: number;
}

export function turetilenTuketim(s: Pick<SarfSayilari, "paketBasiNorm" | "normSonrasiPaket">): number {
  return yuvarla(s.paketBasiNorm * s.normSonrasiPaket);
}

export function sarfStogu(s: SarfSayilari): number {
  return yuvarla(s.hareketToplami - turetilenTuketim(s));
}

/** Sayımda yazılacak hareket miktarı (fark). */
export function sayimFarki(s: SarfSayilari, sayilan: number): number {
  return yuvarla(sayilan - sarfStogu(s));
}

export type SarfDurumu = "kritik" | "eksi" | "normal";

export function sarfDurumu(s: SarfSayilari): SarfDurumu {
  const stok = sarfStogu(s);
  if (stok < 0) return "eksi";
  if (s.kritikSeviye > 0 && stok <= s.kritikSeviye) return "kritik";
  return "normal";
}

/** Son 30 günlük tüketimle kaç gün yeter; tüketim yoksa null. */
export function sarfTukenmeGun(stok: number, son30Paket: number, paketBasiNorm: number): number | null {
  const gunluk = (son30Paket * paketBasiNorm) / 30;
  if (stok <= 0) return 0;
  if (gunluk <= 0) return null;
  return Math.ceil(stok / gunluk);
}

/** Dönem sarf gideri (TL): paket × norm × birim maliyet. */
export function sarfGideri(paket: number, paketBasiNorm: number, birimMaliyet: number): number {
  return Math.round(paket * paketBasiNorm * birimMaliyet * 100) / 100;
}

function yuvarla(n: number): number {
  return Math.round(n * 100) / 100;
}
