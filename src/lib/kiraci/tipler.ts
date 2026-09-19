/**
 * KİRACI MARKASI — istemciye inebilen, serileştirilebilir tanım.
 *
 * Panel iki kimlikle açılır:
 *  · `platform`  → paket.marjpanel.com (ve yerel geliştirme): MarjPanel Paket.
 *  · `kiraci`    → şirketin kendi adresi (mamaaura.marjpanel.com): şirketin
 *    logosu/adı birincil; MarjPanel "altyapı" notu olarak her yerde kalır.
 *
 * Kimlikler içermez (sirketId yalnız kabuk kapısında karşılaştırma için).
 */
export interface KiraciMarkasi {
  tur: "platform" | "kiraci";
  sirketId: string | null;
  /** Görünen marka adı. */
  ad: string;
  /** `/g/<dosya>` — açık zemin logosu; yoksa ad metin olarak çizilir. */
  logoAcik: string | null;
  /** Mürekkep zemin logosu; yoksa açık logo beyaz plakada. */
  logoKoyu: string | null;
  alanAdi: string | null;
}

export const PLATFORM_ADI = "MarjPanel Paket";

export const PLATFORM_MARKASI: KiraciMarkasi = {
  tur: "platform",
  sirketId: null,
  ad: PLATFORM_ADI,
  logoAcik: null,
  logoKoyu: null,
  alanAdi: null,
};
