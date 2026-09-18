/**
 * Yay (spring) tabanlı hareket yardımcıları.
 *
 * Apple'ın "Designing Fluid Interfaces" yaklaşımı: jestle sürüklenen her şey
 * 1:1 parmağı takip eder, bırakıldığında animasyon PARMAĞIN HIZIYLA devam eder
 * ve her an yakalanıp ters çevrilebilir. Sabit süreli CSS geçişleri bunu
 * yapamaz — bu yüzden burada küçük bir yay çözücü var.
 *
 * Parametreler Apple'ın ikilisiyle ifade edilir:
 *   · tepki (response) — hedefe ne kadar çabuk varılacağı, saniye. Süre DEĞİL.
 *   · sonum (damping ratio) — 1.0 kritik sönüm (taşma yok, varsayılan),
 *     ~0.8 hafif taşma (yalnız jest ivme taşıdıysa: fırlatma, savurma).
 */

/** Kullanıcı hareketi azaltmayı seçmiş mi? */
export function azaltilmisHareket(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface YayAyarlari {
  /** Başlangıç değeri (px). Kesme durumunda EKRANDAKİ anlık değer verilir. */
  baslangic: number;
  hedef: number;
  /** Bırakma anındaki hız (px/sn) — jestten devralınır. */
  hiz?: number;
  /** Saniye. 0.3 çekmece, 0.4 taşıma/döndürme. */
  tepki?: number;
  /** 1.0 kritik sönüm (varsayılan) · 0.8 hafif taşma. */
  sonum?: number;
  adim: (deger: number, hiz: number) => void;
  bitti?: () => void;
}

/** Çalışan bir yayı temsil eder; `durdur()` anlık değeri geri verir. */
export interface YayKolu {
  durdur: () => { deger: number; hiz: number };
  /** Animasyon hâlâ sürüyor mu? */
  calisiyor: () => boolean;
}

const SABIT_ADIM = 1 / 240; // sn — sabit alt adım, kare hızından bağımsız
const KONUM_ESIGI = 0.08; // px
const HIZ_ESIGI = 0.8; // px/sn

/**
 * Yayı başlatır. Dönen koluyla her an durdurulabilir; durdurulduğunda anlık
 * konum ve HIZ geri döner — böylece yeni animasyon kesintisiz devralır
 * (hız süreksizliği = "tuğla duvar" hissi olmaz).
 */
export function yayOynat(ayar: YayAyarlari): YayKolu {
  const tepki = ayar.tepki ?? 0.4;
  const sonum = ayar.sonum ?? 1;
  const w0 = (2 * Math.PI) / Math.max(tepki, 0.01);

  let x = ayar.baslangic;
  let v = ayar.hiz ?? 0;
  let sonZaman = 0;
  let rafId = 0;
  let bittiMi = false;

  // Hareket azaltılmışsa yay yerine anında hedefe otur (görsel sıçrama yok,
  // vestibüler rahatsızlık yok) — geri bildirim opaklıkla verilir.
  if (azaltilmisHareket()) {
    ayar.adim(ayar.hedef, 0);
    ayar.bitti?.();
    return { durdur: () => ({ deger: ayar.hedef, hiz: 0 }), calisiyor: () => false };
  }

  const kare = (zaman: number) => {
    if (bittiMi) return;
    if (sonZaman === 0) sonZaman = zaman;
    // Sekme arka plandayken biriken devasa dt'yi kırp.
    let dt = Math.min((zaman - sonZaman) / 1000, 0.064);
    sonZaman = zaman;

    while (dt > 0) {
      const h = Math.min(dt, SABIT_ADIM);
      const ivme = -(w0 * w0) * (x - ayar.hedef) - 2 * sonum * w0 * v;
      v += ivme * h;
      x += v * h;
      dt -= h;
    }

    if (Math.abs(x - ayar.hedef) < KONUM_ESIGI && Math.abs(v) < HIZ_ESIGI) {
      x = ayar.hedef;
      v = 0;
      bittiMi = true;
      ayar.adim(x, v);
      ayar.bitti?.();
      return;
    }

    ayar.adim(x, v);
    rafId = requestAnimationFrame(kare);
  };

  rafId = requestAnimationFrame(kare);

  return {
    durdur() {
      if (!bittiMi) cancelAnimationFrame(rafId);
      bittiMi = true;
      return { deger: x, hiz: v };
    },
    calisiyor: () => !bittiMi,
  };
}

/**
 * İvme izdüşümü — jest nereye "gidiyorsa" oraya. Apple'ın örnek kodundaki
 * üstel sönüm biçimi (v²/2a ders kitabı formülü DEĞİL).
 *
 * @param hiz px/sn cinsinden bırakma hızı
 * @param sonumOrani 0.998 normal kaydırma hissi · 0.99 daha çevik
 */
export function ivmeIzdusumu(hiz: number, sonumOrani = 0.998): number {
  return ((hiz / 1000) * sonumOrani) / (1 - sonumOrani);
}

/**
 * Lastik bant direnci — sınırın ötesinde ilerledikçe takip azalır. Sert
 * duvar "donmuş", kademeli direnç "burada daha fazlası yok" der.
 */
export function lastikBant(tasma: number, boyut: number, sabit = 0.55): number {
  if (boyut <= 0) return 0;
  return (tasma * boyut * sabit) / (boyut + sabit * Math.abs(tasma));
}

interface Ornek {
  deger: number;
  zaman: number;
}

/**
 * Hız izleyici: son birkaç pointermove örneğinden bırakma anındaki hızı
 * çıkarır. Tek karelik fark gürültülüdür — kısa bir pencere kullanılır.
 */
export class HizIzleyici {
  private ornekler: Ornek[] = [];
  private readonly pencereMs: number;

  constructor(pencereMs = 100) {
    this.pencereMs = pencereMs;
  }

  sifirla(deger: number): void {
    this.ornekler = [{ deger, zaman: performance.now() }];
  }

  ekle(deger: number): void {
    const zaman = performance.now();
    this.ornekler.push({ deger, zaman });
    const en_eski = zaman - this.pencereMs;
    while (this.ornekler.length > 2 && this.ornekler[0]!.zaman < en_eski) {
      this.ornekler.shift();
    }
  }

  /** px/sn. Örnek yoksa 0. */
  hiz(): number {
    if (this.ornekler.length < 2) return 0;
    const ilk = this.ornekler[0]!;
    const son = this.ornekler[this.ornekler.length - 1]!;
    const dt = (son.zaman - ilk.zaman) / 1000;
    if (dt <= 0.001) return 0;
    return (son.deger - ilk.deger) / dt;
  }
}

/** Dokunsal geri bildirim — yalnız anlamlı anlarda (kenetlenme, onay). */
export function titret(desen: number | number[] = 8): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(desen);
    }
  } catch {
    /* desteklenmiyorsa sessizce geç */
  }
}

/* -------------------------------------------------------------------------- */

export type JestKarari = "belirsiz" | "yatay" | "dikey";

/**
 * Bir parmak hareketinin sürükleme mi yoksa dokunuş mu olduğuna karar verir.
 *
 * En kritik nokta: KARARSIZ kalmak serbesttir. Eşiğin altındaki hareket
 * "belirsiz" döner ve jest hiçbir şeyi üstlenmez — böylece parmak birkaç piksel
 * kaysa bile altındaki bağlantının tıklaması yaşar. Eşik düşük tutulup her
 * küçük kayma "yatay" sayılırsa pointer yakalanır, tıklama olayı hiç doğmaz ve
 * menüde bağlantıya basmak işe yaramaz.
 *
 * @param dx yatay yer değiştirme (px)
 * @param dy dikey yer değiştirme (px)
 * @param klaimEsigi sürüklemeyi üstlenmek için gereken asgari mesafe
 * @param yatayOran yatay niyetin dikeyin kaç katı olması gerektiği
 */
export function jestKarari(
  dx: number,
  dy: number,
  klaimEsigi = 16,
  yatayOran = 1.5,
): JestKarari {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Dikey niyet netse listeyi tarayıcı kaydırsın.
  if (ay >= klaimEsigi && ay > ax) return "dikey";
  // Yatay sürükleme ancak BELİRGİN ve baskın hareketle üstlenilir.
  if (ax >= klaimEsigi && ax > ay * yatayOran) return "yatay";
  return "belirsiz";
}
