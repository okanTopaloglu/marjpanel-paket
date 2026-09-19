import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/marka", { recursive: true });

/*
 * MAMA AURA kelime işareti — iki zemin için iki PNG.
 *
 * Kaynak: tr.mamaaura.com'daki resmi logo (scripts/marka/mamaaura-logo.png,
 * 721x137, "MAMA" siyah + "AURA" kırmızı #D81040, saydam zemin). Tuvalde
 * 24 px boşluk var; ikisi de KIRPILARAK üretilir ki bileşen kenar boşluğunu
 * kendisi yönetsin ve yükseklik hesabı görünür harflere göre olsun.
 *
 *   mamaaura.png       — açık zemin (üst çubuk, giriş kartı): orijinal renkler.
 *   mamaaura-koyu.png  — mürekkep zemin (menü): siyah harfler --menu-foreground
 *                        (#EAF0F6) olur, kırmızı AYNEN kalır. Yalnız "koyu"
 *                        pikseller dönüştürülür; kenar yumuşatma alfa'da
 *                        korunduğu için harfler tırtıklanmaz.
 *
 * Çıktılar src/components/marka/mama-aura.tsx içinde sabit en/boy ile
 * kullanılır; bu betik boyutu yazdırır, oradaki sabit onunla eşleşmeli.
 */
const KAYNAK = "scripts/marka/mamaaura-logo.png";
const MENU_METIN = { r: 0xea, g: 0xf0, b: 0xf6 }; // #EAF0F6

const kirpik = await sharp(KAYNAK).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
await sharp(kirpik).toFile("public/marka/mamaaura.png");

const { data, info } = await sharp(kirpik).raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] === 0) continue;
  // Kırmızı kanal baskınsa marka kırmızısıdır, dokunma. Gerisi siyah harf
  // (ve kenar yumuşatmasının gri tonları) → menü metin rengi.
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const kirmizi = r > 120 && r > g * 2 && r > b * 2;
  if (kirmizi) continue;
  data[i] = MENU_METIN.r;
  data[i + 1] = MENU_METIN.g;
  data[i + 2] = MENU_METIN.b;
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile("public/marka/mamaaura-koyu.png");

console.log(`✓ public/marka/mamaaura.png ve mamaaura-koyu.png (${info.width}x${info.height})`);
