/**
 * HESAP KESİMİ HESAPLARI — saf, test edilir. Para KURUŞ TAM SAYISI olarak
 * dolaşır (kayan nokta toplama hatası olmasın); veritabanına yazarken
 * `kurusMetni` ile "123.45" biçimine çevrilir.
 */
export interface Kademe {
  /** Bu adede kadar (dâhil); null = sınırsız (son kademe). */
  ustSinir: number | null;
  /** TL, kuruşlu ondalık (15.5). */
  birimFiyat: number;
}

export interface EkHizmet {
  kod: string;
  ad: string;
  birimFiyat: number;
}

export type KademeTipi = "toplam" | "dilimli";

export interface TarifeTanimi {
  kademeTipi: KademeTipi;
  kademeler: Kademe[];
  ekHizmetler: EkHizmet[];
  /** Yüzde (20). */
  kdvOrani: number;
}

export interface KesimKalemi {
  tur: "paket" | "ek_hizmet" | "diger";
  aciklama: string;
  adet: number;
  /** kuruş */
  birimFiyatKurus: number;
  /** kuruş */
  tutarKurus: number;
}

export interface KesimSonucu {
  kalemler: KesimKalemi[];
  araToplamKurus: number;
  kdvOrani: number;
  kdvKurus: number;
  genelToplamKurus: number;
}

export const kurus = (tl: number): number => Math.round(tl * 100);
export const kurusMetni = (k: number): string => (k / 100).toFixed(2);
export const kurustanTl = (k: number): number => k / 100;

/** Kademeleri üst sınıra göre sıralar; sınırsız en sona. Geçersiz/boş → []. */
export function kademeleriDuzenle(ham: unknown): Kademe[] {
  if (!Array.isArray(ham)) return [];
  const liste = ham
    .map((k) => {
      const o = (k ?? {}) as Record<string, unknown>;
      const ust = o.ustSinir === null || o.ustSinir === undefined || o.ustSinir === "" ? null : Number(o.ustSinir);
      const fiyat = Number(o.birimFiyat);
      if ((ust !== null && (!Number.isFinite(ust) || ust <= 0)) || !Number.isFinite(fiyat) || fiyat < 0) return null;
      return { ustSinir: ust === null ? null : Math.floor(ust), birimFiyat: fiyat };
    })
    .filter((k): k is Kademe => k !== null);
  return liste.sort((a, b) => (a.ustSinir ?? Infinity) - (b.ustSinir ?? Infinity));
}

export function ekHizmetleriDuzenle(ham: unknown): EkHizmet[] {
  if (!Array.isArray(ham)) return [];
  const gorulen = new Set<string>();
  const cikti: EkHizmet[] = [];
  for (const k of ham) {
    const o = (k ?? {}) as Record<string, unknown>;
    const kod = String(o.kod ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const ad = String(o.ad ?? "").trim();
    const fiyat = Number(o.birimFiyat);
    if (!kod || !ad || !Number.isFinite(fiyat) || fiyat < 0 || gorulen.has(kod)) continue;
    gorulen.add(kod);
    cikti.push({ kod, ad, birimFiyat: fiyat });
  }
  return cikti;
}

/**
 * Paket ücreti kalemleri.
 *  · toplam: aylık adedin düştüğü kademenin fiyatı tüm paketlere (tek kalem).
 *  · dilimli: her dilim kendi fiyatıyla (kalem başına dilim).
 * Kademe yoksa ücret 0 (tarife tanımlanmamış uyarısı arayüzde).
 */
export function paketKalemleri(paketSayisi: number, tipi: KademeTipi, kademeler: Kademe[]): KesimKalemi[] {
  const n = Math.max(0, Math.floor(paketSayisi));
  const sirali = kademeleriDuzenle(kademeler);
  if (sirali.length === 0 || n === 0) {
    return [{ tur: "paket", aciklama: "Paket hazırlama", adet: n, birimFiyatKurus: 0, tutarKurus: 0 }];
  }

  if (tipi === "toplam") {
    const k = sirali.find((x) => x.ustSinir === null || n <= x.ustSinir) ?? sirali[sirali.length - 1]!;
    const bf = kurus(k.birimFiyat);
    return [{ tur: "paket", aciklama: "Paket hazırlama", adet: n, birimFiyatKurus: bf, tutarKurus: bf * n }];
  }

  const kalemler: KesimKalemi[] = [];
  let kalan = n;
  let alt = 0;
  for (const k of sirali) {
    if (kalan <= 0) break;
    const kapasite = k.ustSinir === null ? kalan : Math.max(0, k.ustSinir - alt);
    const adet = Math.min(kalan, kapasite);
    if (adet <= 0) {
      alt = k.ustSinir ?? alt;
      continue;
    }
    const bf = kurus(k.birimFiyat);
    kalemler.push({
      tur: "paket",
      aciklama: k.ustSinir === null ? `Paket hazırlama (${alt + 1}+)` : `Paket hazırlama (${alt + 1}–${k.ustSinir})`,
      adet,
      birimFiyatKurus: bf,
      tutarKurus: bf * adet,
    });
    kalan -= adet;
    alt = k.ustSinir ?? alt;
  }
  return kalemler;
}

export interface DigerKalem {
  aciklama: string;
  adet: number;
  birimFiyat: number;
}

export function kesimHesapla(
  paketSayisi: number,
  tarife: TarifeTanimi,
  ekHizmetAdetleri: Record<string, number> = {},
  digerKalemler: DigerKalem[] = [],
): KesimSonucu {
  const kalemler = paketKalemleri(paketSayisi, tarife.kademeTipi, tarife.kademeler);

  for (const h of ekHizmetleriDuzenle(tarife.ekHizmetler)) {
    const adet = Math.max(0, Math.floor(Number(ekHizmetAdetleri[h.kod] ?? 0)));
    if (adet === 0) continue;
    const bf = kurus(h.birimFiyat);
    kalemler.push({ tur: "ek_hizmet", aciklama: h.ad, adet, birimFiyatKurus: bf, tutarKurus: bf * adet });
  }

  for (const d of digerKalemler) {
    const adet = Number(d.adet);
    const bf = kurus(Number(d.birimFiyat));
    if (!d.aciklama.trim() || !Number.isFinite(adet) || adet === 0 || !Number.isFinite(bf)) continue;
    kalemler.push({ tur: "diger", aciklama: d.aciklama.trim(), adet, birimFiyatKurus: bf, tutarKurus: Math.round(bf * adet) });
  }

  const araToplamKurus = kalemler.reduce((t, k) => t + k.tutarKurus, 0);
  const kdvOrani = Number.isFinite(tarife.kdvOrani) && tarife.kdvOrani >= 0 ? tarife.kdvOrani : 0;
  const kdvKurus = Math.round((araToplamKurus * kdvOrani) / 100);
  return { kalemler, araToplamKurus, kdvOrani, kdvKurus, genelToplamKurus: araToplamKurus + kdvKurus };
}

/** Dönem anahtarı "YYYY-MM" doğrulaması ve sınırları (İstanbul). */
export function donemMi(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function donemAraligi(donem: string): { baslangic: string; bitis: string } {
  const [y, a] = donem.split("-").map(Number) as [number, number];
  const son = new Date(Date.UTC(y, a, 0)).getUTCDate();
  return { baslangic: `${donem}-01`, bitis: `${donem}-${String(son).padStart(2, "0")}` };
}

export function donemAdi(donem: string): string {
  const [y, a] = donem.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, a - 1, 1)));
}

/** Bir önceki ay (varsayılan kesim dönemi). */
export function oncekiDonem(bugun = new Date()): string {
  const y = bugun.getUTCFullYear();
  const a = bugun.getUTCMonth(); // 0 tabanlı → önceki ay = a
  const d = new Date(Date.UTC(y, a - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
