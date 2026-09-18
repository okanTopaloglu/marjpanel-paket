import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

/**
 * Pazaryeri API kimlik bilgilerini uygulama katmanında AES-256-GCM ile şifreler.
 * Anahtar env `APP_ENCRYPTION_KEY`'den türetilir (sha256 → sabit 32 bayt), böylece
 * anahtar formatı (hex/base64/serbest metin) fark etmez. Yalnızca sunucu tarafı.
 *
 * Biçim: base64(iv).base64(authTag).base64(ciphertext)
 */
function anahtar(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY tanımlı değil.");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function sifrele(duz: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", anahtar(), iv);
  const enc = Buffer.concat([cipher.update(duz, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function coz(yuk: string): string {
  const parcalar = yuk.split(".");
  if (parcalar.length !== 3) throw new Error("Geçersiz şifreli veri biçimi.");
  const [ivB, tagB, encB] = parcalar as [string, string, string];
  const decipher = createDecipheriv(
    "aes-256-gcm",
    anahtar(),
    Buffer.from(ivB, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Arayüze inen değer: ilk 3 + son 3 karakter, arası yıldız. */
export function maskele(deger: string): string {
  if (deger.length <= 6) return "*".repeat(deger.length);
  return `${deger.slice(0, 3)}${"*".repeat(Math.min(deger.length - 6, 12))}${deger.slice(-3)}`;
}
