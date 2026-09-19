import ExcelJS from "exceljs";

/**
 * EXCEL ÜRÜN OKUYUCU - pazaryeri ürün listesi (.xlsx) → ürün satırları.
 *
 * NEDEN SÜTUN TAHMİNİ VAR: satıcı dosyayı Trendyol panelinden, muhasebe
 * programından ya da kendi şablonundan indirir; başlıklar "Barkod",
 * "barcode", "Ürün Adı", "Product Name", "Resim URL" gibi onlarca biçimde
 * gelir. Kullanıcıya "sütunları şu sırayla dizin" demek, dosyayı elle
 * düzenlemek demektir - içe aktarmanın bütün faydası oradan kaçar. Bu yüzden
 * başlıklar normalize edilip tahmin listesiyle eşleştirilir; hangi sütunun
 * neye bağlandığı `sutunlar` ile GERİ BİLDİRİLİR (arayüz önizlemede gösterir,
 * yanlış eşleşme kaydetmeden önce görünür).
 *
 * BAŞLIK SATIRI ARANIR, "ilk satır" VARSAYILMAZ: pazaryeri dışa aktarımları
 * çoğu zaman üstte bir logo/başlık/boş satır taşır. İlk 10 satır taranır, en
 * çok sütunu eşleşen satır başlık kabul edilir.
 *
 * BARKOD SÜTUNU ZORUNLUDUR. Bulunamazsa satır DÖNDÜRÜLMEZ: sütunları konuma
 * göre tahmin etmek (A=barkod, B=ad) sessizce yanlış katalog yazmanın en
 * kısa yoludur - ürün adı sütununu barkod sanan bir içe aktarım, okutma
 * ekranını çöp barkodlarla doldurur. Çağıran `sutunlar.barkod === null`
 * gördüğünde kullanıcıya hangi başlıkları beklediğini söyler.
 *
 * Saf DEĞİL ama yan etkisiz: yalnız verilen tamponu okur, veritabanına
 * dokunmaz.
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

/** Alanların insan okunur adları (arayüzdeki eşleme özeti). */
export const ALAN_ETIKETLERI: Record<AlanAnahtari, string> = {
  barkod: "Barkod",
  urunAdi: "Ürün adı",
  gorselUrl: "Görsel URL",
  marka: "Marka",
  kategori: "Kategori",
  stokKodu: "Stok kodu",
};

/**
 * Başlık tahminleri. `tam` önce denenir (birebir eşitlik), sonra `parca`
 * (içerme). İki aşama şart: "stok kodu" hem `stokKodu`nun tam eşleşmesi hem
 * `barkod`un hiçbir tahminine denk gelmez, ama tek aşamalı içerme aramasında
 * "ürün kodu" gibi başlıklar yanlış alana düşebilirdi.
 */
const TAHMINLER: Record<AlanAnahtari, { tam: string[]; parca: string[] }> = {
  barkod: {
    tam: ["barkod", "barcode", "ean", "gtin", "barkodno", "barkodnumarasi"],
    parca: ["barkod", "barcode"],
  },
  urunAdi: {
    tam: [
      "urunadi",
      "urunismi",
      "ad",
      "adi",
      "isim",
      "productname",
      "product",
      "name",
      "title",
      "urunbasligi",
    ],
    parca: ["urunadi", "productname", "producttitle", "urunbaslik"],
  },
  gorselUrl: {
    tam: [
      "gorsel",
      "gorselurl",
      "gorsellink",
      "resim",
      "resimurl",
      "resimlink",
      "image",
      "imageurl",
      "imagelink",
      "url",
      "foto",
      "fotograf",
    ],
    parca: ["gorsel", "resim", "image", "foto"],
  },
  marka: { tam: ["marka", "brand"], parca: ["marka", "brand"] },
  kategori: {
    tam: ["kategori", "category", "kategoriadi"],
    parca: ["kategori", "category"],
  },
  stokKodu: {
    tam: [
      "stokkodu",
      "stok",
      "stockcode",
      "stoccode",
      "sku",
      "merchantsku",
      "saticistokkodu",
      "modelkodu",
      "urunkodu",
    ],
    parca: ["stokkodu", "stockcode", "sku"],
  },
};

const TURKCE_HARF: Record<string, string> = {
  ı: "i",
  İ: "i",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ş: "s",
  Ş: "s",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
};

/**
 * Başlık karşılaştırma biçimi: Türkçe harfler sadeleşir, harf/rakam dışı her
 * şey düşer. "Ürün Adı", "urun_adi", "ÜRÜN ADI " hepsi "urunadi" olur.
 */
export function basligiNormalize(ham: unknown): string {
  const metin = typeof ham === "string" ? ham : String(ham ?? "");
  let cikti = "";
  for (const harf of metin) {
    const sade = TURKCE_HARF[harf] ?? harf;
    cikti += sade;
  }
  return cikti.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Hücre değerini düz metne indirger. exceljs hücreleri zengin metin,
 * köprü, formül ya da hata nesnesi olarak da döndürebilir; hepsini `String()`
 * ile ezmek "[object Object]" yazan bir katalog üretirdi.
 */
export function hucreMetni(deger: unknown): string {
  if (deger === null || deger === undefined) return "";
  if (typeof deger === "string") return deger.trim();
  if (typeof deger === "number" || typeof deger === "boolean") {
    return String(deger);
  }
  if (deger instanceof Date) return deger.toISOString().slice(0, 10);

  if (typeof deger === "object") {
    const o = deger as {
      text?: unknown;
      hyperlink?: unknown;
      richText?: Array<{ text?: unknown }>;
      result?: unknown;
      error?: unknown;
    };
    if (o.error !== undefined) return "";
    if (Array.isArray(o.richText)) {
      // Parçalar TEK TEK kırpılmaz: "Mavi " + "Tişört" arasındaki boşluk
      // kelimeleri ayıran boşluktur, kenar boşluğu değil.
      return o.richText
        .map((p) => (typeof p?.text === "string" ? p.text : ""))
        .join("")
        .trim();
    }
    // Köprü hücresinde görünen metin boşsa adresin kendisi kullanılır
    // (görsel URL sütunu çoğu dosyada köprü olarak gelir).
    if (o.text !== undefined || o.hyperlink !== undefined) {
      const gorunen = hucreMetni(o.text);
      return gorunen || hucreMetni(o.hyperlink);
    }
    if (o.result !== undefined) return hucreMetni(o.result);
  }
  return "";
}

export interface SutunEslemesi {
  /** Alan → 0 tabanlı sütun indisi (bulunamadıysa null). */
  indisler: Record<AlanAnahtari, number | null>;
  /** Alan → dosyadaki başlık metni (bulunamadıysa null). */
  sutunlar: Record<AlanAnahtari, string | null>;
  /** Eşleşen alan sayısı - başlık satırı seçiminde kullanılır. */
  skor: number;
}

function bosEsleme(): SutunEslemesi {
  const indisler = {} as Record<AlanAnahtari, number | null>;
  const sutunlar = {} as Record<AlanAnahtari, string | null>;
  for (const alan of ALAN_ANAHTARLARI) {
    indisler[alan] = null;
    sutunlar[alan] = null;
  }
  return { indisler, sutunlar, skor: 0 };
}

/**
 * Başlık hücrelerini alanlara bağlar. Bir sütun yalnız BİR alana bağlanır
 * (aksi hâlde "Ürün kodu" hem stok kodu hem ürün adı olurdu) ve bir alan
 * yalnız İLK eşleşen sütunu alır.
 */
export function sutunlariEsle(basliklar: unknown[]): SutunEslemesi {
  const sonuc = bosEsleme();
  const normal = basliklar.map((b) => basligiNormalize(hucreMetni(b)));
  const kullanilan = new Set<number>();

  const bagla = (alan: AlanAnahtari, i: number) => {
    sonuc.indisler[alan] = i;
    sonuc.sutunlar[alan] = hucreMetni(basliklar[i]) || null;
    kullanilan.add(i);
    sonuc.skor += 1;
  };

  // 1) Birebir eşleşme.
  for (const alan of ALAN_ANAHTARLARI) {
    const tam = TAHMINLER[alan].tam;
    for (let i = 0; i < normal.length; i += 1) {
      const b = normal[i];
      if (!b || kullanilan.has(i)) continue;
      if (tam.includes(b)) {
        bagla(alan, i);
        break;
      }
    }
  }

  // 2) Kalan alanlar için içerme.
  for (const alan of ALAN_ANAHTARLARI) {
    if (sonuc.indisler[alan] !== null) continue;
    const parca = TAHMINLER[alan].parca;
    for (let i = 0; i < normal.length; i += 1) {
      const b = normal[i];
      if (!b || kullanilan.has(i)) continue;
      if (parca.some((p) => b.includes(p))) {
        bagla(alan, i);
        break;
      }
    }
  }

  return sonuc;
}

/** Satırın hücrelerini 0 tabanlı diziye çevirir (exceljs 1 tabanlı sayar). */
function satirHucreleri(satir: ExcelJS.Row, sutunSayisi: number): unknown[] {
  const hucreler: unknown[] = [];
  for (let c = 1; c <= sutunSayisi; c += 1) {
    hucreler.push(satir.getCell(c).value);
  }
  return hucreler;
}

/**
 * .xlsx tamponunu ürün satırlarına çevirir. İlk sayfa okunur - pazaryeri
 * dışa aktarımlarında veri her zaman ilk sayfadadır, ikincisi genelde
 * açıklama/sözlük olur.
 */
export async function urunOku(
  tampon: ArrayBuffer | Uint8Array,
): Promise<OkumaSonucu> {
  const kitap = new ExcelJS.Workbook();
  /*
   * exceljs kendi global `Buffer extends ArrayBuffer` bildirimini yapar;
   * Node'un `Buffer`ı (Uint8Array) ona atanamaz. Görünümün kendi dilimi
   * alınıp ArrayBuffer'a çevrilir - `.buffer`ı doğrudan vermek, havuzlanmış
   * Node tamponlarında KOMŞU dosyanın baytlarını da okuturdu.
   */
  const ham =
    tampon instanceof Uint8Array
      ? tampon.buffer.slice(
          tampon.byteOffset,
          tampon.byteOffset + tampon.byteLength,
        )
      : tampon;
  await kitap.xlsx.load(ham as unknown as Parameters<typeof kitap.xlsx.load>[0]);

  const sayfa = kitap.worksheets[0];
  if (!sayfa) {
    return { satirlar: [], atlanan: 0, sutunlar: bosEsleme().sutunlar, baslikSatiri: null };
  }

  const sutunSayisi = Math.max(1, sayfa.columnCount || 1);
  const satirSayisi = sayfa.rowCount || 0;

  // Başlık satırını seç: ilk 10 satır içinde barkodu eşleşen ve en çok alan
  // bağlayan satır.
  let enIyi: { satir: number; esleme: SutunEslemesi } | null = null;
  const tarama = Math.min(BASLIK_TARAMA_SATIRI, satirSayisi);
  for (let r = 1; r <= tarama; r += 1) {
    const esleme = sutunlariEsle(satirHucreleri(sayfa.getRow(r), sutunSayisi));
    if (esleme.indisler.barkod === null) continue;
    if (!enIyi || esleme.skor > enIyi.esleme.skor) enIyi = { satir: r, esleme };
  }

  if (!enIyi) {
    return { satirlar: [], atlanan: 0, sutunlar: bosEsleme().sutunlar, baslikSatiri: null };
  }

  const { indisler, sutunlar } = enIyi.esleme;
  const al = (hucreler: unknown[], alan: AlanAnahtari): string => {
    const i = indisler[alan];
    return i === null ? "" : hucreMetni(hucreler[i]);
  };

  const satirlar: ExcelUrunSatiri[] = [];
  let atlanan = 0;

  for (let r = enIyi.satir + 1; r <= satirSayisi; r += 1) {
    if (satirlar.length >= AZAMI_SATIR) break;
    const hucreler = satirHucreleri(sayfa.getRow(r), sutunSayisi);
    // Tamamen boş satır atlanan sayılmaz: dışa aktarımların sonunda ya da
    // arasında boş satır olması sıradandır, kullanıcıya hata gibi görünmesin.
    if (hucreler.every((h) => hucreMetni(h) === "")) continue;

    const barkod = al(hucreler, "barkod");
    if (!barkod) {
      atlanan += 1;
      continue;
    }

    satirlar.push({
      barkod,
      urunAdi: al(hucreler, "urunAdi"),
      gorselUrl: al(hucreler, "gorselUrl"),
      marka: al(hucreler, "marka"),
      kategori: al(hucreler, "kategori"),
      stokKodu: al(hucreler, "stokKodu"),
    });
  }

  return { satirlar, atlanan, sutunlar, baslikSatiri: enIyi.satir };
}
