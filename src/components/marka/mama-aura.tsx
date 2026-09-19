import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * MAMA AURA — bu kurulumun MÜŞTERİ MARKASI.
 *
 * Panel MAMA AURA'nın depo ekibi için ayakta; giriş ekranından her sayfaya
 * kadar kimin paneli olduğu belli olsun. MarjPanel ise altyapıdır: küçük bir
 * "altyapı" notu olarak kalır (bkz. logo.tsx), sahne MAMA AURA'nındır.
 *
 * İKİ BİÇİM, tr.mamaaura.com'dan:
 *  · Kelime işareti — resmi logo PNG'si ("MAMA" siyah + "AURA" kırmızı).
 *    Vektörü elimizde yok; PNG 712 px genişlikte, panelde en fazla ~240 px
 *    gösterildiği için her ekranda 2x+ keskin. Mürekkep menü için harfleri
 *    açık renge çevrilmiş ikinci kopya vardır (scripts/gen-marka.mjs).
 *  · İşaret — sitenin favicon'undaki ters üçgen, satır içi SVG. Dar menüde,
 *    ana ekrana ekle kartında ve uygulama simgesinde (scripts/gen-icons.mjs
 *    AYNI yolu paylaşır) kullanılır.
 *
 * RENK KURALI: marka kırmızısı yalnız işaretin/kelime işaretinin İÇİNDE
 * yaşar. Buton, seçili satır, odak halkası nane kalır — DESIGN.md "vurgu
 * rengi tektir" ilkesi müşteri markasıyla delinmez; tıpkı pazaryeri
 * rozetlerinin rengi taşıyıp dolgu almaması gibi.
 */
export const MAMAAURA_KIRMIZI = "#D81040";
/** Üçgen — 512 ızgarasında, dikey merkezde; gen-icons.mjs ile birebir. */
export const MAMAAURA_UCGEN_YOLU = "M72 66 H440 L256 446 Z";

/** public/marka/mamaaura*.png'nin gerçek boyutu (gen-marka.mjs yazdırır). */
const YAZI_G = 712;
const YAZI_Y = 89;

/** Kırmızı yuvarlak kare üstünde beyaz ters üçgen — uygulama simgesiyle aynı. */
export function MamaAuraIsaret({
  className,
  boyut = 36,
}: {
  className?: string;
  /** Kenar uzunluğu, px. */
  boyut?: number;
}) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 512 512"
      role="img"
      aria-label="MAMA AURA"
      className={cn("shrink-0", className)}
    >
      <rect width="512" height="512" rx="112" fill={MAMAAURA_KIRMIZI} />
      <path
        d={MAMAAURA_UCGEN_YOLU}
        transform="translate(256 256) scale(0.8) translate(-256 -256)"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="24"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Kelime işareti. `zemin` hangi kopyanın geleceğini seçer: açık zeminde
 * orijinal, mürekkep menüde harfleri açık renkli kopya.
 *
 * `altAd` — alt uygulama etiketi ("Paket"): MAMA AURA'nın birden çok panel
 * kullanacağı düşünülerek küçük bir hap. Rengi zemine göre seçilir; küçük
 * büyük harfli metin için kırmızı açık zeminde koyulaştırılır (AA), koyu
 * zeminde açılır.
 *
 * `unoptimized`: 9 KB'lık statik PNG için görüntü işleyiciye gitmenin
 * getirisi yok; standalone imajda sharp'a çalışma zamanında bağımlılık da
 * kalmaz.
 */
export function MamaAuraYazi({
  className,
  zemin = "acik",
  yukseklik = 20,
  altAd,
  oncelik = false,
}: {
  className?: string;
  zemin?: "acik" | "koyu";
  /** Görünür harf yüksekliği, px. Genişlik 8:1 orandan türetilir. */
  yukseklik?: number;
  altAd?: string;
  /** Giriş ekranında LCP olduğu için önden yüklensin. */
  oncelik?: boolean;
}) {
  const genislik = Math.round((yukseklik * YAZI_G) / YAZI_Y);
  const koyu = zemin === "koyu";
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={koyu ? "/marka/mamaaura-koyu.png" : "/marka/mamaaura.png"}
        alt="MAMA AURA"
        width={genislik}
        height={yukseklik}
        priority={oncelik}
        unoptimized
        draggable={false}
        className="block h-auto shrink-0 select-none"
        style={{ width: genislik, height: yukseklik }}
      />
      {altAd && (
        <span
          className={cn(
            "ml-2 inline-flex items-center rounded-full px-1.5 py-px font-bold uppercase tracking-[0.08em]",
            koyu
              ? "bg-[#D81040]/25 text-[#FF8FAA]"
              : "bg-[#D81040]/10 text-[#B80D36]",
          )}
          style={{ fontSize: Math.max(9, Math.round(yukseklik * 0.55)) }}
        >
          {altAd}
        </span>
      )}
    </span>
  );
}
