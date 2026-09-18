/**
 * Pazaryeri ham yükünden ARAYÜZE İNECEK asgari alt küme.
 *
 * `pazaryeri_siparisleri.ham_veri` Trendyol'un yükünün TAMAMIDIR: alıcının
 * TC kimlik alanı, fatura adresi, vergi bilgisi, satır bazlı fiyat ve komisyon
 * dâhil. Liste ekranına bunun tamamını indirmek hem gereksiz (tablo üç alan
 * gösterir) hem de sızıntı yüzeyidir. Repo katmanı satırları HER ZAMAN bu
 * fonksiyonlardan geçirir; `hamVeri` istemciye asla ham hâliyle inmez.
 *
 * Saf fonksiyonlar (G/Ç yok, test edilir). PartnerSys `minimalRawData` ve
 * `barcodePrint.getAddress/getProductLines` portudur.
 */

export interface AsgariKalem {
  barkod: string;
  urunAdi: string;
  adet: number;
}

export interface AsgariHamVeri {
  musteriAd: string;
  /** Tek satırlık adres özeti: "İlçe - İl" (liste ekranı için yeterli). */
  adresOzeti: string;
  kalemler: AsgariKalem[];
}

export interface EtiketAdresi {
  /** Açık adres (mahalle/sokak/kapı). */
  acik: string;
  /** "İlçe - İl". */
  ilceIl: string;
}

/** Nesneden sırayla ilk DOLU alanı seçer (PartnerSys `pick` portu). */
function sec(nesne: unknown, ...anahtarlar: string[]): string {
  if (!nesne || typeof nesne !== "object") return "";
  const o = nesne as Record<string, unknown>;
  for (const a of anahtarlar) {
    const v = o[a];
    if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  return "";
}

function kalemDizisi(ham: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(ham.lines) ? (ham.lines as Record<string, unknown>[]) : [];
}

/** Müşteri adı: ad + soyad, yoksa tek alanlık ad, o da yoksa tire. */
export function musteriAdi(hamVeri: unknown): string {
  const ham = (hamVeri ?? {}) as Record<string, unknown>;
  const ad = sec(ham, "customerFirstName");
  const soyad = sec(ham, "customerLastName");
  const birlesik = `${ad} ${soyad}`.trim();
  if (birlesik) return birlesik;
  return sec(ham, "customerName", "recipientName") || "-";
}

/**
 * Adres: Trendyol yükü adresi `shipmentAddress` altında verir; bazı uçlarda
 * `customerAddress`/`shippingAddress` gelir, en kötü durumda kökte durur.
 */
export function etiketAdresi(hamVeri: unknown): EtiketAdresi {
  const ham = (hamVeri ?? {}) as Record<string, unknown>;
  const adres =
    (ham.shipmentAddress as unknown) ??
    (ham.customerAddress as unknown) ??
    (ham.shippingAddress as unknown) ??
    ham;

  const a1 = sec(adres, "address1", "address", "fullAddress", "street");
  const a2 = sec(adres, "address2", "addressDetail");
  const mahalle = sec(adres, "neighborhood", "quarter");
  const il = sec(adres, "city", "cityName");
  const ilce = sec(adres, "district", "districtName");

  const acik = [a1, a2, mahalle].filter(Boolean).join(" ");
  return {
    acik: acik || sec(ham, "address1", "address"),
    ilceIl: [ilce, il].filter(Boolean).join(" - "),
  };
}

/** Etiketteki alıcı telefonu; yoksa boş metin. */
export function aliciTelefonu(hamVeri: unknown): string {
  const ham = (hamVeri ?? {}) as Record<string, unknown>;
  const adres = (ham.shipmentAddress as unknown) ?? ham;
  return sec(adres, "phone", "gsm", "phoneNumber") || sec(ham, "customerPhone");
}

/** Sipariş kalemleri: barkod + ürün adı + adet. */
export function siparisKalemleri(hamVeri: unknown): AsgariKalem[] {
  const ham = (hamVeri ?? {}) as Record<string, unknown>;
  return kalemDizisi(ham).map((l) => {
    const barkod =
      sec(l, "barcode", "barcodeNumber", "merchantSku", "stockCode", "productCode", "sku") ||
      sec(l.product, "barcode", "merchantSku");
    const adet = Number(l.quantity ?? l.amount ?? 1);
    return {
      barkod,
      urunAdi: sec(l, "productName", "name") || sec(l.product, "productName", "name") || "-",
      adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
    };
  });
}

/** Liste ekranına inen alt küme. Tam ham yük İSTEMCİYE GİTMEZ. */
export function asgariHamVeri(hamVeri: unknown): AsgariHamVeri {
  const adres = etiketAdresi(hamVeri);
  return {
    musteriAd: musteriAdi(hamVeri),
    adresOzeti: adres.ilceIl,
    kalemler: siparisKalemleri(hamVeri),
  };
}
