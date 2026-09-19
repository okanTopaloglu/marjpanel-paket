/**
 * Sekme → SQL KOŞULU (saf fonksiyon, G/Ç yok, test edilir).
 *
 * PartnerSys `buildStatusWhere` portu. Orada koşullar Prisma nesnesiydi ve
 * "bugün 17:00" eşiği SUNUCUNUN saatiyle (`new Date().setHours(17,0,0,0)`)
 * hesaplanıyordu: konteyner UTC koştuğu için eşik aslında 20:00 İstanbul'a
 * düşüyordu ve "17:00 öncesi sevk edilmemiş" listesi üç saat geç doluyordu.
 * Burada eşik SQL'de, `AT TIME ZONE 'Europe/Istanbul'` ile hesaplanır -
 * uygulamanın saat dilimi ne olursa olsun sonuç aynıdır.
 *
 * Dönen metin SABİTLERDEN üretilir; içine kullanıcı girdisi girmez. Çağıran
 * `sql.raw` ile gömer (bkz. repos/siparisler). Metin döndürmenin sebebi test
 * edilebilirlik: drizzle SQL nesnesinin içini okumak yerine koşulun kendisi
 * dize olarak doğrulanır.
 */
import { NIHAI_DURUMLAR, SEVK_KESIM_SAATI, ISTANBUL_TZ } from "./sabitler";
import type { Sekme } from "./durum";

/** SQL `in (...)` listesi; değerler beyaz listeden gelir, tırnak kaçışı gerekmez. */
function liste(degerler: readonly string[]): string {
  return degerler.map((d) => `'${d}'`).join(", ");
}

/** Kargoya verilmiş/iptal sayılan, "bekleyen" havuzundan çıkaran durumlar. */
const HAVUZ_DISI = ["Shipped", "Delivered", "Cancelled"] as const;

/** Toplama havuzuna girebilen ham durumlar. */
const HAVUZ_ICI = ["Created", "Picking", "Invoiced"] as const;

/**
 * Bugün 17:00 (İstanbul) anının `timestamptz` karşılığı.
 *
 * `now() at time zone 'Europe/Istanbul'` mutlak anı İstanbul duvar saatine
 * çevirir (saat dilimsiz `timestamp`); `date_trunc` ile günün başına inilir,
 * kesim saati eklenir ve ikinci `at time zone` ile yeniden mutlak ana
 * dönülür. Yaz saati geçişlerinde de doğru çalışan tek yol budur.
 */
export function kesimAniSql(saat: number = SEVK_KESIM_SAATI): string {
  // Saat TAM SAYI ve 0..23'e kırpılır: SQL'e giren tek "değişken" budur.
  const s = Math.min(23, Math.max(0, Math.trunc(Number.isFinite(saat) ? saat : SEVK_KESIM_SAATI)));
  return `((date_trunc('day', now() at time zone '${ISTANBUL_TZ}') + interval '${s} hours') at time zone '${ISTANBUL_TZ}')`;
}

/** Varsayılan (17:00) kesim anı; şirket saati bilinmeyen yerler için. */
export const KESIM_ANI_SQL = kesimAniSql(SEVK_KESIM_SAATI);

/**
 * Sekmenin SQL koşulu. `tumu` için `true` döner - çağıran özel durum
 * yazmasın, koşul her zaman `and` zincirine eklenebilsin. `kesimSaati`
 * şirketin sevk kesim saatidir (sirketler.sevk_kesim_saati).
 */
export function sekmeKosulu(sekme: Sekme, kesimSaati: number = SEVK_KESIM_SAATI): string {
  switch (sekme) {
    case "tumu":
      return "true";

    case "bekleyen":
      return `hazir_zamani is null and durum not in (${liste(HAVUZ_DISI)})`;

    case "bekleyen_kargo":
      return `hazir_zamani is null and durum in (${liste(HAVUZ_ICI)})`;

    case "hazir":
      return `hazir_zamani is not null and durum not in (${liste(HAVUZ_DISI)})`;

    // Takip numarası BOŞ METİN de olabiliyor (Trendyol kargo atanmadan önce
    // alanı "" yollar); `is not null` tek başına yetmez.
    case "kargoda":
      return `durum in ('Shipped', 'Delivered') and kargo_takip_no is not null and kargo_takip_no <> ''`;

    case "iptal":
      return `durum = 'Cancelled'`;

    // Nihai duruma GELMEMİŞ ve sipariş tarihi bugünkü kesim saatinden önce
    // olan her şey: dünün kalanları da bu kesitte görünür (PartnerSys'teki
    // iki dallı OR ile aynı sonuç, tek karşılaştırmayla).
    case "sevk_gecikmis":
      return `durum not in (${liste(NIHAI_DURUMLAR)}) and siparis_tarihi is not null and siparis_tarihi < ${kesimAniSql(kesimSaati)}`;
  }
}
