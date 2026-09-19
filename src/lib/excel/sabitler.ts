/**
 * Excel içe aktarma sabitleri ve tipleri. exceljs İÇERMEZ: istemci bileşeni
 * (excel-aktar.tsx) bu dosyayı içe aktarır; `urun-oku.ts` içe aktarılsaydı
 * exceljs (~250 kB) tarayıcı paketine sızardı.
 */
export const ALAN_ANAHTARLARI = [
  "barkod",
  "urunAdi",
  "gorselUrl",
  "marka",
  "kategori",
  "stokKodu",
] as const;

export type AlanAnahtari = (typeof ALAN_ANAHTARLARI)[number];

export interface ExcelUrunSatiri {
  barkod: string;
  urunAdi: string;
  gorselUrl: string;
  marka: string;
  kategori: string;
  stokKodu: string;
}

export interface OkumaSonucu {
  satirlar: ExcelUrunSatiri[];
  /** Barkodu boş olduğu için atlanan veri satırı sayısı. */
  atlanan: number;
  /** Alan → dosyada eşleşen başlık metni (bulunamadıysa null). */
  sutunlar: Record<AlanAnahtari, string | null>;
  /** Başlığın bulunduğu satır numarası (1 tabanlı); bulunamadıysa null. */
  baslikSatiri: number | null;
}

/** Başlık aranırken taranan satır sayısı. */
export const BASLIK_TARAMA_SATIRI = 10;

/** Tek dosyadan okunacak azami veri satırı (bellek koruması). */
export const AZAMI_SATIR = 50_000;

/**
 * Kabul edilen azami dosya boyutu. `next.config.ts` içindeki sunucu eylemi
 * gövde sınırıyla (`serverActions.bodySizeLimit`) AYNI olmalıdır; büyük
 * dosya oraya takılırsa kullanıcı anlamsız bir çerçeve hatası görür.
 */
export const AZAMI_DOSYA_BAYT = 10 * 1024 * 1024;

/** İçe aktarma önizlemesinde gösterilen satır sayısı. */
export const ONIZLEME_SATIRI = 20;

/** Alanların insan okunur adları (arayüzdeki eşleme özeti). */
export const ALAN_ETIKETLERI: Record<AlanAnahtari, string> = {
  barkod: "Barkod",
  urunAdi: "Ürün adı",
  gorselUrl: "Görsel URL",
  marka: "Marka",
  kategori: "Kategori",
  stokKodu: "Stok kodu",
};

