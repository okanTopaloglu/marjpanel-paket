import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

/*
 * MarjPanel marka işareti — "Marj basamakları" (Mürekkep & Nane).
 *
 * Nane yuvarlak kare + mürekkep renkli, sağa yükselen üç basamak. Uygulama
 * içindeki logo (src/components/marka/logo.tsx) ile AYNI yol ve AYNI iki
 * renk: telefondaki simge ile paneldeki işaret farklı görünmesin. Gradyan,
 * ışık yakalaması ve iç kenar çizgisi bilinçli olarak yok; tasarım sistemi
 * düz yüzey tanır.
 *
 * Renkler globals.css token'larıyla aynı:
 *   nane  #12A874  (--vurgu-parlak)      mürekkep  #0F1B2D  (--ink)
 */
const NANE = "#12A874";
const MUREKKEP = "#0F1B2D";
const BASAMAK = "M104 408 V312 H200 V216 H296 V120 H408 V408 Z";

/**
 * @param rx       köşe yarıçapı (512 ızgarasında)
 * @param olcek    basamak grubunun ölçeği (1 = logo.tsx ile birebir)
 * @param kalinlik stroke genişliği: küçük boyutta köşeler daha yumuşak dursun
 */
function svg({ rx, olcek = 1, kalinlik = 28 }) {
  const s = 512;
  // Ölçekleme merkez etrafında: basamaklar güvenli bölgede kalır.
  const merkez = s / 2;
  const t = `translate(${merkez} ${merkez}) scale(${olcek}) translate(${-merkez} ${-merkez})`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" rx="${rx}" fill="${NANE}"/>
  <path d="${BASAMAK}" transform="${t}" fill="${MUREKKEP}" stroke="${MUREKKEP}" stroke-width="${kalinlik}" stroke-linejoin="round"/>
</svg>`;
}

async function png(svgStr, size, out) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(out);
  console.log("✓", out);
}

// Normal: köşe 112/512 ≈ %22 (paneldeki kart yarıçapının ölçeği).
const normal = svg({ rx: 112 });
await png(normal, 192, "public/icons/icon-192.png");
await png(normal, 512, "public/icons/icon-512.png");
await png(normal, 180, "public/apple-touch-icon.png");

// Favicon 32px: basamaklar biraz büyür, köşeler daha yumuşak.
const favicon = svg({ rx: 96, olcek: 1.08, kalinlik: 36 });
await png(favicon, 32, "public/favicon-32.png");

// Maskable (Android kırpar): tam kare zemin, basamaklar güvenli bölgede (~%70).
const maskable = svg({ rx: 0, olcek: 0.72 });
await png(maskable, 512, "public/icons/icon-maskable-512.png");

console.log("İkonlar hazır.");
