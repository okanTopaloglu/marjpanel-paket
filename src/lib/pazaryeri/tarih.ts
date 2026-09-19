/**
 * SAAT DİLİMSİZ TARİH METNİ → MUTLAK AN. SAF, süreç saat diliminden bağımsız.
 *
 * "2026-03-01T10:00:00" gibi işaretsiz bir metni `new Date()` KONTEYNERİN
 * yerel saatiyle okur: üretimde UTC, geliştirici makinesinde İstanbul —
 * aynı metin iki farklı an olur ve testler makineye göre geçer/kalır.
 * Pazaryerleri bu metinleri Türkiye saatinde verir (UTC+3, 2016'dan beri yaz
 * saati yok). Burada bileşenler elle ayrıştırılıp UTC olarak kurulur ve
 * ofset saat düşülür; sonuç her makinede aynıdır.
 *
 * İşaretli metin ("…Z", "…+03:00") ve epoch sayıları buraya GELMEZ — onlar
 * zaten mutlaktır; çağıran önce onları ayıklar.
 */
const DILIMSIZ =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

export const ISTANBUL_OFSET_SAAT = 3;

export function dilimsizMetniCoz(metin: string, ofsetSaat = ISTANBUL_OFSET_SAAT): Date | null {
  const m = DILIMSIZ.exec(metin.trim());
  if (!m) {
    const d = new Date(metin);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, ay, g, s = "0", dk = "0", sn = "0", ms = "0"] = m;
  const utc = Date.UTC(
    Number(y),
    Number(ay) - 1,
    Number(g),
    Number(s),
    Number(dk),
    Number(sn),
    Number(ms.padEnd(3, "0")),
  );
  if (Number.isNaN(utc)) return null;
  return new Date(utc - ofsetSaat * 3_600_000);
}

/** Metin saat dilimi işareti taşıyor mu ("Z", "+03:00", "-0500"). */
export const SAAT_DILIMI_ISARETI = /(?:Z|[+-]\d{2}:?\d{2})$/i;
