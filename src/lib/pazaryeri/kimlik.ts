import { z } from "zod";
import { coz, maskele, sifrele } from "@/lib/guvenlik/sifreleme";
import { PAZARYERLERI, type AlanTanimi } from "./kayit";
import type { Platform } from "./tipler";

/**
 * KİMLİK BİLGİLERİ — pazaryeri başına farklı alan kümesi, TEK şifreli sütun.
 *
 * `entegrasyonlar.kimlik_sifreli` = AES-256-GCM(JSON.stringify({alan: değer})).
 * Trendyol üç alan (saticiId/apiKey/apiSecret), Amazon iki (sellerId/
 * refreshToken) taşır; her platform için sütun açmak yerine JSON şifrelenir.
 * Şema `kayit.ts`teki alan tanımlarından üretilir: form, doğrulama ve
 * maskeleme aynı tanımı okur, üçü birbirinden ayrı düşemez.
 */
export type Kimlik = Record<string, string>;

/**
 * Zod şeması. `duzenleme` true ise GİZLİ alanlar boş bırakılabilir (form
 * anahtarı maskeli gösterir, boş "değiştirme" demektir); metin alanlar her
 * zaman zorunludur çünkü listede açık görünür ve kullanıcı ne yazdığını bilir.
 */
export function kimlikSemasi(platform: Platform, duzenleme = false) {
  const sekil: Record<string, z.ZodTypeAny> = {};
  for (const alan of PAZARYERLERI[platform].alanlar) {
    let s = z.string().trim().max(500, `${alan.etiket} en fazla 500 karakter olabilir.`);
    if (alan.desen) {
      s = s.regex(new RegExp(alan.desen), alan.desenMesaji ?? `${alan.etiket} geçersiz.`);
    }
    const bosOlabilir = !alan.zorunlu || (duzenleme && alan.tip === "gizli");
    sekil[alan.ad] = bosOlabilir
      ? s.optional().or(z.literal(""))
      : s.min(1, `${alan.etiket} gerekli.`);
  }
  return z.object(sekil);
}

export function kimlikSifrele(kimlik: Kimlik): string {
  return sifrele(JSON.stringify(kimlik));
}

/** Çözemezse fırlatır (APP_ENCRYPTION_KEY değişmiş olabilir); çağıran yakalar. */
export function kimlikCoz(yuk: string): Kimlik {
  const ham = JSON.parse(coz(yuk)) as unknown;
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) {
    throw new Error("Kimlik yükü nesne değil.");
  }
  const cikti: Kimlik = {};
  for (const [k, v] of Object.entries(ham as Record<string, unknown>)) {
    if (typeof v === "string") cikti[k] = v;
  }
  return cikti;
}

/** Arayüze inen kopya: gizli alanlar maskeli, metin alanlar açık. */
export function kimlikMaskele(platform: Platform, kimlik: Kimlik): Kimlik {
  const cikti: Kimlik = {};
  for (const alan of PAZARYERLERI[platform].alanlar) {
    const v = kimlik[alan.ad];
    if (v === undefined) continue;
    cikti[alan.ad] = alan.tip === "gizli" ? maskele(v) : v;
  }
  return cikti;
}

/**
 * Düzenlemede birleştirme: gizli alan boş geldiyse ESKİSİ korunur. Boşu "sil"
 * saymak her ad değişikliğinde entegrasyonu bozardı.
 */
export function kimlikBirlestir(alanlar: AlanTanimi[], eski: Kimlik, yeni: Kimlik): Kimlik {
  const cikti: Kimlik = { ...eski };
  for (const alan of alanlar) {
    const v = yeni[alan.ad]?.trim();
    if (v) cikti[alan.ad] = v;
    else if (alan.tip !== "gizli") cikti[alan.ad] = "";
  }
  return cikti;
}

/** Hesap kimliği (satici_id sütunu): tanımdaki alanın değeri. */
export function hesapKimligi(platform: Platform, kimlik: Kimlik): string {
  return (kimlik[PAZARYERLERI[platform].hesapKimligiAlani] ?? "").trim();
}
