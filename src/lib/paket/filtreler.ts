/**
 * Paket listesi filtreleri - URL ile ekran arasındaki saf çeviri katmanı.
 *
 * Filtreler adres çubuğunda yaşar: kullanıcı bağlantıyı paylaşabilsin, geri
 * tuşu çalışsın, sunucu bileşeni ilk boyamada doğru veriyi çekebilsin. Bu
 * dosya `searchParams` → `PaketFiltreleri` ve tersi dönüşümü yapar; hiçbir
 * yerde veritabanına ya da router'a dokunmaz (bu yüzden test edilebilir).
 */
import { gunAnahtariMi } from "@/lib/format/tarih";

export interface PaketFiltreleri {
  /** Barkod içinde arama (ilike). */
  arama: string;
  kaynak: string;
  kargo: string;
  /** Okutan kullanıcı kimliği; `calisan` rolünde sunucu kendi kimliğini dayatır. */
  kullanici: string;
  /** `YYYY-MM-DD` (Europe/Istanbul takvim günü). */
  baslangic: string;
  bitis: string;
}

export const BOS_FILTRELER: PaketFiltreleri = {
  arama: "",
  kaynak: "",
  kargo: "",
  kullanici: "",
  baslangic: "",
  bitis: "",
};

/** Bir sayfada gösterilen satır sayısı. */
export const SAYFA_LIMITI = 50;

type HamDeger = string | string[] | undefined;

function tek(deger: HamDeger): string {
  if (Array.isArray(deger)) return (deger[0] ?? "").trim();
  return (deger ?? "").trim();
}

/**
 * `searchParams` → filtreler + sayfa. Geçersiz değerler SESSİZCE düşer:
 * elle kurcalanmış bir adres yüzünden sayfa hata vermez, filtresiz açılır.
 * Sayfa numarası dışarıda 1 tabanlıdır (kullanıcı 1. sayfayı görür), içeride
 * 0 tabanlı döner (repo `offset` hesabı).
 */
export function filtreleriCoz(ham: Record<string, HamDeger>): {
  filtreler: PaketFiltreleri;
  sayfa: number;
} {
  const baslangic = tek(ham.baslangic);
  const bitis = tek(ham.bitis);
  const sayfaHam = Number(tek(ham.sayfa));
  const sayfa =
    Number.isInteger(sayfaHam) && sayfaHam >= 1 ? sayfaHam - 1 : 0;

  return {
    filtreler: {
      arama: tek(ham.arama).slice(0, 64),
      kaynak: tek(ham.kaynak),
      kargo: tek(ham.kargo),
      kullanici: tek(ham.kullanici),
      baslangic: gunAnahtariMi(baslangic) ? baslangic : "",
      bitis: gunAnahtariMi(bitis) ? bitis : "",
    },
    sayfa,
  };
}

/**
 * Filtreler → sorgu dizesi. Boş alanlar YAZILMAZ: adres çubuğu yalnız
 * gerçekten uygulanan filtreleri gösterir. Sayfa 0 ise atlanır (ilk sayfa
 * adresin varsayılanıdır).
 */
export function filtreSorgusu(f: PaketFiltreleri, sayfa = 0): string {
  const p = new URLSearchParams();
  if (f.arama) p.set("arama", f.arama);
  if (f.kaynak) p.set("kaynak", f.kaynak);
  if (f.kargo) p.set("kargo", f.kargo);
  if (f.kullanici) p.set("kullanici", f.kullanici);
  if (f.baslangic) p.set("baslangic", f.baslangic);
  if (f.bitis) p.set("bitis", f.bitis);
  if (sayfa > 0) p.set("sayfa", String(sayfa + 1));
  return p.toString();
}

/** Kaç filtre aktif ("Filtrele (N)" rozeti). Arama da bir filtredir. */
export function aktifFiltreSayisi(f: PaketFiltreleri): number {
  return (
    (f.arama ? 1 : 0) +
    (f.kaynak ? 1 : 0) +
    (f.kargo ? 1 : 0) +
    (f.kullanici ? 1 : 0) +
    (f.baslangic ? 1 : 0) +
    (f.bitis ? 1 : 0)
  );
}

/** Toplam satırdan sayfa sayısı (en az 1 - boş liste de bir sayfadır). */
export function sayfaSayisi(toplam: number, limit = SAYFA_LIMITI): number {
  return Math.max(1, Math.ceil(toplam / limit));
}
