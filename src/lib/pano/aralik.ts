import { gunAnahtari, gunAnahtariKaydir, gunAnahtariMi } from "@/lib/format/tarih";

/**
 * PANO TARİH ÖN AYARLARI - saf fonksiyonlar.
 *
 * Sunucu (sayfa, varsayılan aralık) ve istemci (çip şeridi) AYNI hesabı
 * kullanır. PartnerSys'te bu mantık bileşenin içinde `new Date()` ile
 * duruyordu: tarayıcının saat dilimi neyse "bugün" oydu, Almanya'daki bir
 * satıcı Türkiye saatiyle 01:30'da "dünü" görüyordu. Burada gün anahtarı
 * (`YYYY-MM-DD`) İstanbul takvimine göre üretilir ve bütün hesap metin
 * üzerinde yapılır - yerel saat hiç karışmaz.
 */

export const ON_AYARLAR = ["bugun", "dun", "buHafta", "buAy", "gecenAy"] as const;
export type OnAyar = (typeof ON_AYARLAR)[number];

export const ON_AYAR_ETIKETLERI: Record<OnAyar, string> = {
  bugun: "Bugün",
  dun: "Dün",
  buHafta: "Bu hafta",
  buAy: "Bu ay",
  gecenAy: "Geçen ay",
};

export interface Aralik {
  baslangic: string;
  bitis: string;
}

function parcala(anahtar: string): { yil: number; ay: number; gun: number } {
  const [y, a, g] = anahtar.split("-").map(Number) as [number, number, number];
  return { yil: y, ay: a, gun: g };
}

function birlestir(yil: number, ay: number, gun: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${yil}-${p(ay)}-${p(gun)}`;
}

/** Haftanın günü: 1 = Pazartesi … 7 = Pazar (ISO). */
function haftaGunu(anahtar: string): number {
  const { yil, ay, gun } = parcala(anahtar);
  const d = new Date(Date.UTC(yil, ay - 1, gun)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Ayın son günü. */
function ayinSonu(yil: number, ay: number): number {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

/**
 * Ön ayarın gün aralığı. Hafta PAZARTESİ başlar (Türkiye'de vardiya ve
 * muhasebe haftası böyle sayılır); "bu hafta" ve "bu ay" BUGÜNDE biter,
 * gelecek günler aralığa katılmaz.
 */
export function onAyarAraligi(onAyar: OnAyar, bugun: string = gunAnahtari()): Aralik {
  const { yil, ay } = parcala(bugun);

  switch (onAyar) {
    case "bugun":
      return { baslangic: bugun, bitis: bugun };
    case "dun": {
      const dun = gunAnahtariKaydir(bugun, -1);
      return { baslangic: dun, bitis: dun };
    }
    case "buHafta":
      return {
        baslangic: gunAnahtariKaydir(bugun, -(haftaGunu(bugun) - 1)),
        bitis: bugun,
      };
    case "buAy":
      return { baslangic: birlestir(yil, ay, 1), bitis: bugun };
    case "gecenAy": {
      const gecenYil = ay === 1 ? yil - 1 : yil;
      const gecenAy = ay === 1 ? 12 : ay - 1;
      return {
        baslangic: birlestir(gecenYil, gecenAy, 1),
        bitis: birlestir(gecenYil, gecenAy, ayinSonu(gecenYil, gecenAy)),
      };
    }
  }
}

/** Aralık hangi ön ayara denk düşüyor (hiçbiriyse null - "özel aralık"). */
export function aktifOnAyar(
  aralik: Aralik,
  bugun: string = gunAnahtari(),
): OnAyar | null {
  for (const onAyar of ON_AYARLAR) {
    const a = onAyarAraligi(onAyar, bugun);
    if (a.baslangic === aralik.baslangic && a.bitis === aralik.bitis) return onAyar;
  }
  return null;
}

/**
 * URL'den gelen aralığı doğrular. Geçersiz ya da eksik değer BUGÜNE düşer;
 * ters verilen (başlangıç > bitiş) aralık takas edilir - kullanıcıya boş
 * ekran göstermek yerine kastettiği aralığı vermek doğru davranıştır.
 */
export function araligiCoz(
  baslangic: string | null | undefined,
  bitis: string | null | undefined,
  bugun: string = gunAnahtari(),
): Aralik {
  const b1 = gunAnahtariMi(baslangic) ? baslangic : null;
  const b2 = gunAnahtariMi(bitis) ? bitis : null;

  if (!b1 && !b2) return { baslangic: bugun, bitis: bugun };
  const bas = b1 ?? b2 ?? bugun;
  const bit = b2 ?? b1 ?? bugun;
  return bas <= bit
    ? { baslangic: bas, bitis: bit }
    : { baslangic: bit, bitis: bas };
}
