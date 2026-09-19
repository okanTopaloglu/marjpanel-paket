import { icerikImzasi } from "@/lib/siparis/icerik-imzasi";
import type { SiparisDurumu } from "@/lib/siparis/sabitler";
import type { NormalAdres, NormalKalem, NormalSiparis, Platform } from "./tipler";

/**
 * NORMAL SİPARİŞ → VERİTABANI SATIRI.
 *
 * `ham_veri` sütunu pazaryeri yükünün tamamını taşımaya devam eder (etiket
 * ve detay oradan okur) ama artık bir de `_normal` ZARFI vardır: müşteri adı,
 * adres ve kalemler sağlayıcının normalize ettiği hâliyle. `lib/siparis/
 * ham-veri` ve `icerik-imzasi` ÖNCE bu zarfa bakar, yoksa Trendyol alan
 * adlarıyla sezgisel okumaya düşer. Böylece:
 *   · etiket/okutma/toplama/detay kodu platform bilmez,
 *   · zarfsız eski satırlar (bu değişiklikten önce yazılanlar) bozulmaz.
 */
export const NORMAL_ZARF_SURUMU = 1;

export interface NormalZarf {
  surum: number;
  musteriAd: string;
  adres: NormalAdres;
  kalemler: NormalKalem[];
}

/** `topluUpsert`in beklediği satır. */
export interface EslenenSiparis {
  platform: Platform;
  siparisKimligi: string;
  siparisNo: string | null;
  kargoTakipNo: string | null;
  durum: SiparisDurumu;
  hamDurum: string | null;
  siparisTarihi: Date | null;
  hamVeri: Record<string, unknown>;
  icerikImzasi: string | null;
  entegrasyonAdi: string;
  kargoFirmasi: string | null;
}

export function normaldenSatir(n: NormalSiparis, entegrasyonAdi: string): EslenenSiparis {
  const zarf: NormalZarf = {
    surum: NORMAL_ZARF_SURUMU,
    musteriAd: n.musteriAd,
    adres: n.adres,
    kalemler: n.kalemler,
  };
  return {
    platform: n.platform,
    siparisKimligi: n.siparisKimligi,
    siparisNo: n.siparisNo,
    kargoTakipNo: n.kargoTakipNo,
    durum: n.durum,
    hamDurum: n.hamDurum,
    siparisTarihi: n.siparisTarihi,
    hamVeri: { ...n.ham, _normal: zarf },
    icerikImzasi: icerikImzasi(n.kalemler),
    entegrasyonAdi,
    kargoFirmasi: n.kargoFirmasi,
  };
}

/** `ham_veri` içindeki zarfı okur; yoksa null (eski satır ya da bozuk yük). */
export function normalZarf(hamVeri: unknown): NormalZarf | null {
  if (!hamVeri || typeof hamVeri !== "object") return null;
  const z = (hamVeri as Record<string, unknown>)._normal;
  if (!z || typeof z !== "object") return null;
  const o = z as Record<string, unknown>;
  if (typeof o.musteriAd !== "string" || !Array.isArray(o.kalemler)) return null;
  const a = (o.adres ?? {}) as Record<string, unknown>;
  return {
    surum: typeof o.surum === "number" ? o.surum : 0,
    musteriAd: o.musteriAd,
    adres: {
      acik: String(a.acik ?? ""),
      ilce: String(a.ilce ?? ""),
      il: String(a.il ?? ""),
      telefon: String(a.telefon ?? ""),
    },
    kalemler: (o.kalemler as unknown[]).map((k) => {
      const kk = (k ?? {}) as Record<string, unknown>;
      const adet = Number(kk.adet ?? 1);
      return {
        barkod: String(kk.barkod ?? ""),
        urunAdi: String(kk.urunAdi ?? "-"),
        adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
        sku: typeof kk.sku === "string" ? kk.sku : null,
      };
    }),
  };
}
