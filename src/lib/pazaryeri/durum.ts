import {
  SIPARIS_DURUMLARI,
  durumNormalize,
  type SiparisDurumu,
} from "@/lib/siparis/sabitler";
import type { Platform } from "./tipler";

/**
 * KANONİK DURUM EŞLEMESİ — her pazaryerinin ham durumu tek kümeye iner.
 *
 * Veritabanındaki `durum` sütunu Trendyol adlarıyla doğdu (Created, Picking,
 * Shipped…) ve sekme SQL'i, toplama havuzu, 17:00 kesimi bu adlara bakar.
 * Yeni pazaryerleri kendi adlarını buraya eşler; SQL değişmez.
 *
 * BİLİNMEYEN DURUM: `Created` sayılır ama BİR KEZ uyarı loglanır (değer
 * başına). Sessizce Created saymak tehlikelidir — tanınmayan bir "iptal"
 * durumu havuza girer ve depo iptal siparişi paketler. Log, eksik satırı
 * tabloya ekletir. Her tablonun bilinen tüm durumları kapsadığı testle
 * korunur (`durum.test.ts`).
 */
type DurumTablosu = Readonly<Record<string, SiparisDurumu>>;

/** Trendyol: veritabanı adları zaten Trendyol'unki; birebir. */
const TRENDYOL: DurumTablosu = Object.fromEntries(
  SIPARIS_DURUMLARI.map((d) => [d, d]),
) as DurumTablosu;

export const DURUM_TABLOLARI: Partial<Record<Platform, DurumTablosu>> = {
  trendyol: TRENDYOL,
};

const uyarilan = new Set<string>();

export function kanonikDurum(platform: Platform, ham: string | null | undefined): SiparisDurumu {
  const d = (ham ?? "").trim();
  if (!d) return "Created";

  const tablo = DURUM_TABLOLARI[platform];
  const eslenen = tablo?.[d];
  if (eslenen) return eslenen;

  // Tabloda yoksa beyaz listedeki bir ad olabilir (bazı platformlar Trendyol
  // adlarını kullanır); değilse Created + uyarı.
  const normal = durumNormalize(d);
  const anahtar = `${platform}:${d}`;
  if (normal === "Created" && d !== "Created" && !uyarilan.has(anahtar)) {
    uyarilan.add(anahtar);
    console.warn(
      `[pazaryeri] ${platform}: tanınmayan sipariş durumu "${d}" → Created sayıldı. lib/pazaryeri/durum.ts tablosuna ekleyin.`,
    );
  }
  return normal;
}
