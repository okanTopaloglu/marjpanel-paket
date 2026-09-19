import type { OkutmaSonucu, PerdeTonu } from "@/lib/okut/sonuc";
import { sonucEtiketi, sonucTonu } from "@/lib/okut/sonuc";
import type { PaketSatiri } from "@/lib/db/repos/paketler";

/**
 * Okutma ekranının BELLEKTEKİ satır tipi.
 *
 * Sunucudan gelen son okutmalar (`PaketSatiri`) ile o an okutulan paketin
 * sonucu (`OkutmaSonucu`) aynı listede yan yana durur; ikisi de bu şekle
 * çevrilir. Liste hiçbir zaman sunucudan yeniden çekilmez - her okutma zaten
 * cevabını getirir, ekran onu başa ekler.
 */
export interface OkutmaSatiriGorunum {
  anahtar: string;
  barkod: string;
  /** ISO 8601. */
  zaman: string;
  kaynak: string | null;
  kargoFirmasi: string | null;
  etiket: string;
  ton: PerdeTonu;
}

/** Bellekte tutulan satır sayısı - ekran uzun vardiyada şişmesin. */
export const AZAMI_SATIR = 50;

export function sunucuSatiri(s: PaketSatiri): OkutmaSatiriGorunum {
  return {
    anahtar: s.id,
    barkod: s.barkod,
    zaman: s.okutmaZamani,
    kaynak: s.kaynak,
    kargoFirmasi: s.kargoFirmasi,
    etiket: "Kaydedildi",
    ton: "basari",
  };
}

export function sonucSatiri(
  sonuc: OkutmaSonucu,
  anahtar: string,
): OkutmaSatiriGorunum {
  const ortak = {
    anahtar,
    barkod: sonuc.barkod,
    zaman: new Date().toISOString(),
    etiket: sonucEtiketi(sonuc),
    ton: sonucTonu(sonuc),
  };
  return sonuc.sonuc === "kaydedildi"
    ? { ...ortak, kaynak: sonuc.kaynak, kargoFirmasi: sonuc.kargoFirmasi }
    : { ...ortak, kaynak: null, kargoFirmasi: null };
}
