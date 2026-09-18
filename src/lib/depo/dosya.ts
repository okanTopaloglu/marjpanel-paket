/**
 * GÖRSEL DEPOSU — TEK MODÜL. İleride S3/R2'ye geçiş yalnız bu dosyayı değiştirir.
 *
 * Bugün diske (docker volume, `GORSEL_DIZIN`) yazar; çağıranlar (profil
 * görseli yükleme action'ları, `/g/[dosya]` route'u) yalnız bu dosyanın
 * verdiği fonksiyonları bilir — "dosya nerede duruyor" sorusunu HİÇ sormaz.
 *
 * DOSYA ADI KULLANICIDAN GELMEZ: `dosyaKaydet` orijinal adı hiç görmez,
 * yalnız uzantıyı alır ve `crypto.randomBytes` ile rastgele bir ad üretir.
 * Bu, path traversal'ı KAYIT anında değil KÖKÜNDEN kapatır — path traversal
 * koruması yine de `dosyaYolu`da (OKUMA yönü) tekrarlanır, çünkü DB'deki
 * `dosya_adi` sütunu (yarın bozuk/elle değiştirilmiş bir satır olabilir)
 * güvenilir girdi SAYILMAZ.
 */
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

/** Kabul edilen görsel uzantıları — büyük/küçük harf normalize edilmiş hâliyle. */
const UZANTI_BEYAZ_LISTESI = new Set(["jpeg", "jpg", "png", "webp"]);

/**
 * Görsellerin yazıldığı kök dizin. `GORSEL_DIZIN` tanımsızsa yerel geliştirme
 * varsayılanı `./.uploads` kullanılır (docker-compose'da `/app/uploads`).
 */
function kokDizin(): string {
  return process.env.GORSEL_DIZIN?.trim() || "./.uploads";
}

/** Uzantıyı normalize eder (nokta olmadan, küçük harf). */
function uzantiTemizle(uzanti: string): string {
  return uzanti.trim().toLowerCase().replace(/^\./, "");
}

/**
 * Buffer'ı diske yazar, üretilen rastgele dosya adını döner.
 *
 * `crypto.randomBytes(16)` base64url ile kodlanır (22 karakter, dosya
 * sisteminde ve URL'de sorunsuz) + doğrulanmış uzantı eklenir.
 */
export async function dosyaKaydet(buffer: Buffer, uzanti: string): Promise<string> {
  const temizUzanti = uzantiTemizle(uzanti);
  if (!UZANTI_BEYAZ_LISTESI.has(temizUzanti)) {
    throw new Error(`Desteklenmeyen görsel uzantısı: ${uzanti}`);
  }
  const dizin = kokDizin();
  await mkdir(dizin, { recursive: true });
  const dosyaAdi = `${randomBytes(16).toString("base64url")}.${temizUzanti}`;
  await writeFile(join(dizin, dosyaAdi), buffer);
  return dosyaAdi;
}

/** Diskteki dosyayı siler. Dosya zaten yoksa SESSİZCE geçer (idempotent). */
export async function dosyaSil(dosyaAdi: string): Promise<void> {
  try {
    await unlink(dosyaYolu(dosyaAdi));
  } catch (e) {
    const hata = e as NodeJS.ErrnoException;
    if (hata.code !== "ENOENT") throw e;
  }
}

/**
 * `dosyaAdi`nı DİSK YOLUNA çözer — PATH TRAVERSAL KORUMASI BURADADIR.
 *
 * İKİ savunma birlikte çalışır:
 *  1. `basename()` — `../../etc/passwd` gibi bir girdiden yalnız son
 *     bileşeni (`passwd`) alır; dizin gezintisi ne olursa olsun düşer.
 *  2. UZANTI BEYAZ LİSTESİ — `basename` tek başına ".."yi temizler ama
 *     yürütülebilir/gizli dosya uzantılarına (`.env`, `.sh`) karşı KORUMA
 *     VERMEZ; yalnız jpeg/jpg/png/webp kabul edilerek diskteki KEYFİ bir
 *     dosyanın servis edilmesi engellenir.
 *
 * Girdi geçersizse (traversal denemesi ya da izinsiz uzantı) hata fırlatır —
 * çağıran (route, `dosyaSil`) bunu 404/no-op olarak ele alır.
 */
export function dosyaYolu(dosyaAdi: string): string {
  const guvenliAd = basename(dosyaAdi);
  if (guvenliAd !== dosyaAdi || guvenliAd === "" || guvenliAd.includes("\0")) {
    throw new Error("Geçersiz görsel adı.");
  }
  const noktaIdx = guvenliAd.lastIndexOf(".");
  const uzanti = noktaIdx === -1 ? "" : uzantiTemizle(guvenliAd.slice(noktaIdx + 1));
  if (!UZANTI_BEYAZ_LISTESI.has(uzanti)) {
    throw new Error("Geçersiz görsel uzantısı.");
  }
  return join(kokDizin(), guvenliAd);
}

/**
 * `dosyaAdi`nın geçerli (traversal'sız, beyaz listeli uzantı) olup
 * olmadığını fırlatmadan sınar — route handler'ın 404 dalı için.
 */
export function dosyaAdiGecerliMi(dosyaAdi: string): boolean {
  try {
    dosyaYolu(dosyaAdi);
    return true;
  } catch {
    return false;
  }
}

/** Uzantıdan Content-Type çözer (route handler için). */
export function dosyaIcerikTuru(dosyaAdi: string): string {
  const noktaIdx = dosyaAdi.lastIndexOf(".");
  const uzanti = noktaIdx === -1 ? "" : uzantiTemizle(dosyaAdi.slice(noktaIdx + 1));
  switch (uzanti) {
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
