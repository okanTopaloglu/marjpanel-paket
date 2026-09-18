/**
 * Platform varsayılanı barkod kuralları (sirket_id = NULL). Seed ile yazılır;
 * süper yönetici düzenler, şirketler kendi kurallarını ekleyerek üzerine yazar.
 *
 * Öncelik: küçük değer önce. `60` öneki `627/629` ile çakışmasın diye en sonda
 * (PartnerSys parser'ındaki sıra korunur).
 */
export interface VarsayilanKural {
  barkodOneki: string;
  kaynak: string;
  kargoFirmasi: string;
  oncelik: number;
  aciklama?: string;
}

export const VARSAYILAN_KURALLAR: VarsayilanKural[] = [
  { barkodOneki: "733", kaynak: "Trendyol", kargoFirmasi: "Trendyol Express", oncelik: 10 },
  { barkodOneki: "72700", kaynak: "Trendyol", kargoFirmasi: "Sürat Kargo", oncelik: 10 },
  { barkodOneki: "726", kaynak: "Trendyol", kargoFirmasi: "Aras Kargo", oncelik: 10 },
  { barkodOneki: "627", kaynak: "Hepsiburada", kargoFirmasi: "Hepsijet", oncelik: 20 },
  { barkodOneki: "629", kaynak: "Hepsiburada", kargoFirmasi: "Sürat Kargo", oncelik: 20 },
  { barkodOneki: "112", kaynak: "N11", kargoFirmasi: "Sürat Kargo", oncelik: 30 },
  { barkodOneki: "407", kaynak: "Amazon FBA", kargoFirmasi: "DHL", oncelik: 40 },
  { barkodOneki: "PTT", kaynak: "e-PTT", kargoFirmasi: "PTT Kargo", oncelik: 50 },
  { barkodOneki: "IPH", kaynak: "İdefix", kargoFirmasi: "Hepsijet", oncelik: 60 },
  { barkodOneki: "NV", kaynak: "Novadan", kargoFirmasi: "Yurtiçi Kargo", oncelik: 70 },
  { barkodOneki: "PZ", kaynak: "Pazarama", kargoFirmasi: "Aras Kargo", oncelik: 80 },
  {
    barkodOneki: "60",
    kaynak: "e-Ticaret",
    kargoFirmasi: "Yurtiçi Kargo",
    oncelik: 900,
    aciklama: "Kısa önek; Hepsiburada 62x ile çakışmasın diye en sonda.",
  },
];

export const BILINMEYEN = "Bilinmiyor";
