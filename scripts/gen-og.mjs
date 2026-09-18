import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

/*
 * Paylaşım kartı (og.png) — 1200x630. MarjPanel Paket için.
 *
 * gen-icons.mjs ile AYNI marka çizimi ve AYNI palet kullanılır; sosyal
 * paylaşımda çıkan kart ile ana ekran simgesi farklı görünmesin. Renkler
 * globals.css'teki "Mürekkep & Nane" token'larıyla birebir aynıdır:
 *   --background → #F5F7F6   --foreground → #0F1B2D   --muted-foreground → #5C6878
 *   nane #12A874 / mürekkep #0F1B2D
 *
 * Yazı tipi gömülmez: SVG metni sistem yazı tipi yığınıyla çizilir (sharp
 * içindeki librsvg sunucudaki fontu kullanır). Kart tek seferlik üretilip
 * public/og.png olarak yayınlanır, çalışma anında maliyeti yoktur.
 */
const G = 1200;
const Y = 630;

// Murekkep & Nane: --background #F5F7F6, --foreground #0F1B2D, --muted-foreground #5C6878
const NANE = "#12A874";
const MUREKKEP = "#0F1B2D";
const ZEMIN = "#F5F7F6";
const METIN = "#0F1B2D";
const SOLUK = "#5C6878";
const BASAMAK = "M104 408 V312 H200 V216 H296 V120 H408 V408 Z";

/** Marka isareti: gen-icons.mjs ve logo.tsx ile ayni yol, ayni iki renk. */
function isaret(x, y, boyut) {
  const olcek = boyut / 512;
  return `
  <g transform="translate(${x},${y}) scale(${olcek})">
    <rect width="512" height="512" rx="112" fill="${NANE}"/>
    <path d="${BASAMAK}" fill="${MUREKKEP}" stroke="${MUREKKEP}" stroke-width="28" stroke-linejoin="round"/>
  </g>`;
}

/**
 * Pazaryeri adı rozeti — logo GÖMÜLMEZ, yalnız metin (telif riski yok).
 * Genişlik metin uzunluğundan kestirilir; yedi rozet 96px kenar boşluklarının
 * içinde kalsın diye ölçüler dar tutulur (bkz. aşağıdaki taşma denetimi).
 */
const ROZET_YAZI = 17;
const ROZET_KARAKTER = 9.6; // Segoe UI 17px'te ortalama karakter genişliği
const ROZET_DOLGU = 30;
const ROZET_ARA = 11;

function rozetGenislik(yazi) {
  return yazi.length * ROZET_KARAKTER + ROZET_DOLGU;
}

function rozet(x, y, yazi) {
  const genislik = rozetGenislik(yazi);
  return `
  <g transform="translate(${x},${y})">
    <rect width="${genislik}" height="42" rx="21" fill="#ffffff" fill-opacity="0.72" stroke="#DFE4E8" stroke-width="1.5"/>
    <text x="${genislik / 2}" y="27" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="${ROZET_YAZI}" font-weight="600" fill="${SOLUK}" text-anchor="middle">${yazi}</text>
  </g>`;
}

// DESIGN.md "Pazaryeri kimlikleri" ile aynı sıra: paketleri bu kaynaklardan
// gelen siparişler için okutuyoruz.
const pazaryerleri = [
  "Trendyol",
  "Hepsiburada",
  "N11",
  "Pazarama",
  "PTT AVM",
  "Amazon",
];
const KENAR = 96;
let rozetX = KENAR;
const rozetler = pazaryerleri
  .map((ad) => {
    const parca = rozet(rozetX, 472, ad);
    rozetX += rozetGenislik(ad) + ROZET_ARA;
    return parca;
  })
  .join("");

// Rozet şeridi kenar boşluğunu taşarsa kart kırık görünür — sessizce çıkmasın.
const seritSonu = rozetX - ROZET_ARA;
if (seritSonu > G - KENAR) {
  throw new Error(
    `Rozet şeridi taşıyor: ${Math.round(seritSonu)}px > ${G - KENAR}px. ` +
      "Yazı boyutunu (ROZET_YAZI) ya da dolguyu (ROZET_DOLGU) küçültün.",
  );
}

const svg = `<svg width="${G}" height="${Y}" viewBox="0 0 ${G} ${Y}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${G}" height="${Y}" fill="${ZEMIN}"/>

  ${isaret(96, 84, 96)}

  <text x="212" y="150" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="-1" fill="${METIN}">MarjPanel Paket</text>

  <text x="96" y="272" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="60" font-weight="700" letter-spacing="-2.4" fill="${METIN}">Depo paket okutma</text>
  <text x="96" y="352" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="60" font-weight="700" letter-spacing="-2.4" fill="${METIN}">ve sipariş takibi.</text>

  <text x="96" y="412" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="27" font-weight="400" fill="${SOLUK}">Etiket okutma, paket eşleme ve pazaryeri sipariş durumu tek ekranda.</text>

  ${rozetler}

  <rect x="0" y="${Y - 8}" width="${G}" height="8" fill="${NANE}"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og.png");
console.log("✓ public/og.png (1200x630)");
