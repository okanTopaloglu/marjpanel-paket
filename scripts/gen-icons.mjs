import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

/*
 * MAMA AURA uygulama simgesi — ters üçgen.
 *
 * tr.mamaaura.com'un favicon'u kırmızı (#D81040), aşağı bakan, neredeyse
 * kare kutuya oturan bir üçgendir (ölçüldü: 31x32 px, tepe tam ortada).
 * Logodaki "AURA"nın A harfi de aynı biçimdir; marka bu üçgenle anılır.
 *
 * Ana ekran simgesi: kırmızı yuvarlak kare + BEYAZ üçgen. Saydam zeminli
 * favicon Android'de siyah kutuya düşer, beyaz zemin ise diğer simgelerin
 * arasında kaybolur; dolu kırmızı kare hem markayı taşır hem okunur.
 * Tarayıcı sekmesi (favicon-32) ise sitedekiyle birebir: saydam zemin,
 * kırmızı üçgen.
 *
 * Uygulama içindeki işaret (src/components/marka/mama-aura.tsx) AYNI yolu
 * ve AYNI rengi kullanır; telefondaki simge ile paneldeki işaret ayrı
 * çizilmez. Gradyan, ışık, iç kenar yok — tasarım sistemi düz yüzey tanır.
 *
 *   kırmızı  #D81040   beyaz  #FFFFFF
 */
const KIRMIZI = "#D81040";
const BEYAZ = "#FFFFFF";
/** Üçgen — 512 ızgarasında, dikey merkezde (66..446 → orta 256), 368 genişlik. */
const UCGEN = "M72 66 H440 L256 446 Z";

/**
 * @param rx     köşe yarıçapı (512 ızgarasında)
 * @param olcek  üçgenin ölçeği (1 = mama-aura.tsx ile birebir)
 * @param zemin  arka plan; null = saydam (favicon)
 * @param dolgu  üçgen rengi
 */
function svg({ rx, olcek = 1, zemin = KIRMIZI, dolgu = BEYAZ, kalinlik = 24 }) {
  const s = 512;
  const merkez = s / 2;
  const t = `translate(${merkez} ${merkez}) scale(${olcek}) translate(${-merkez} ${-merkez})`;
  const arka = zemin ? `<rect width="${s}" height="${s}" rx="${rx}" fill="${zemin}"/>` : "";
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  ${arka}
  <path d="${UCGEN}" transform="${t}" fill="${dolgu}" stroke="${dolgu}" stroke-width="${kalinlik}" stroke-linejoin="round"/>
</svg>`;
}

async function png(svgStr, size, out) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(out);
  console.log("✓", out);
}

// Normal: köşe 112/512 ≈ %22 (paneldeki kart yarıçapının ölçeği); üçgen
// biraz küçültülür ki köşe yuvarlağıyla çarpışmasın.
const normal = svg({ rx: 112, olcek: 0.8 });
await png(normal, 192, "public/icons/icon-192.png");
await png(normal, 512, "public/icons/icon-512.png");
await png(normal, 180, "public/apple-touch-icon.png");

// Favicon 32px: sitedekiyle aynı — saydam zemin, kırmızı üçgen, kutuyu doldurur.
const favicon = svg({ rx: 0, olcek: 1.28, zemin: null, dolgu: KIRMIZI, kalinlik: 8 });
await png(favicon, 32, "public/favicon-32.png");

// Maskable (Android kırpar): tam kare zemin, üçgen güvenli bölgede (~%66).
const maskable = svg({ rx: 0, olcek: 0.66 });
await png(maskable, 512, "public/icons/icon-maskable-512.png");

console.log("İkonlar hazır.");
