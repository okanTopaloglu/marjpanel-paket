import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

/*
 * Paylaşım kartı (og.png) — 1200x630. MAMA AURA Paket için.
 *
 * Üstte resmi kelime işareti (public/marka/mamaaura.png — gen-marka.mjs
 * üretir, bu betik ondan SONRA koşar), altta uygulamanın ne yaptığı ve
 * pazaryeri rozetleri. Zemin/metin renkleri globals.css'teki "Mürekkep &
 * Nane" token'larıyla birebir aynıdır; alt şerit ise marka kırmızısı — kart
 * kimin olduğunu tek bakışta söylesin.
 *   --background → #F5F7F6   --foreground → #0F1B2D   --muted-foreground → #5C6878
 *   marka kırmızısı #D81040
 *
 * Yazı tipi gömülmez: SVG metni sistem yazı tipi yığınıyla çizilir (sharp
 * içindeki librsvg sunucudaki fontu kullanır). Kelime işareti PNG olarak
 * ÜSTÜNE bindirilir (composite) — SVG'ye data URI gömmek librsvg'de her
 * sürümde güvenilir değil.
 */
const G = 1200;
const Y = 630;

const KIRMIZI = "#D81040";
const ZEMIN = "#F5F7F6";
const METIN = "#0F1B2D";
const SOLUK = "#5C6878";

/**
 * Pazaryeri adı rozeti — logo GÖMÜLMEZ, yalnız metin (telif riski yok).
 * Genişlik metin uzunluğundan kestirilir; rozetler 96px kenar boşluklarının
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

// Paketleri bu kaynaklardan gelen siparişler için okutuyoruz.
const pazaryerleri = ["Trendyol", "Hepsiburada", "N11", "Pazarama", "idefix", "Amazon"];
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

// Kelime işareti 360px genişlik → 8:1 oran, 45px yükseklik; y=96'da durur.
const LOGO_G = 360;
const LOGO_Y = 96;

const svg = `<svg width="${G}" height="${Y}" viewBox="0 0 ${G} ${Y}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${G}" height="${Y}" fill="${ZEMIN}"/>

  <text x="${KENAR + LOGO_G + 22}" y="${LOGO_Y + 34}" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="2" fill="${SOLUK}">PAKET PANELİ</text>

  <text x="96" y="272" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="60" font-weight="700" letter-spacing="-2.4" fill="${METIN}">Depo paket okutma</text>
  <text x="96" y="352" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="60" font-weight="700" letter-spacing="-2.4" fill="${METIN}">ve sipariş takibi.</text>

  <text x="96" y="412" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="27" font-weight="400" fill="${SOLUK}">Etiket okutma, paket eşleme ve pazaryeri sipariş durumu tek ekranda.</text>

  ${rozetler}

  <text x="${G - KENAR}" y="${Y - 30}" font-family="Segoe UI, -apple-system, Helvetica, Arial, sans-serif" font-size="16" font-weight="500" fill="${SOLUK}" text-anchor="end">MarjPanel Paket altyapısı</text>

  <rect x="0" y="${Y - 8}" width="${G}" height="8" fill="${KIRMIZI}"/>
</svg>`;

const logo = await sharp("public/marka/mamaaura.png").resize({ width: LOGO_G }).png().toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: KENAR, top: LOGO_Y }])
  .png()
  .toFile("public/og.png");
console.log("✓ public/og.png (1200x630)");
