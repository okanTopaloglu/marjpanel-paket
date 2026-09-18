import { cn } from "@/lib/utils";

/**
 * MarjPanel marka işareti — "Marj basamakları".
 *
 * Nane yuvarlak kare üstünde mürekkep renkli, sağa doğru yükselen üç basamak:
 * kâr payının adım adım büyümesi. İki düz renk, gradyan/ışık/gölge yok; panel
 * tasarım sistemiyle (Mürekkep & Nane) aynı iki token. Her zeminde TEK
 * düzenleme kullanılır: nane kare beyaz üst çubukta da mürekkep menüde de
 * kendini gösterir, ana ekran simgesi de birebir aynıdır (scripts/gen-icons.mjs
 * bu yolu paylaşır; ikisi ayrı çizilmez).
 *
 * Genel bir ikon kütüphanesi glifi değil, satır içi SVG: her boyutta net ve
 * tek dosyada tanımlı.
 */
export const MARKA_NANE = "#12A874";
export const MARKA_MUREKKEP = "#0F1B2D";

/**
 * Basamak yolu — 512 ızgarasında. Üç basamak, eşit genişlik (96) ve eşit
 * yükseliş (96); sağdaki blok tabana kadar iner ki şekil bir "tepe" değil
 * bir "büyüme" okunsun. Kenarlar `stroke-linejoin: round` ile yumuşar.
 */
export const MARKA_BASAMAK_YOLU = "M104 408 V312 H200 V216 H296 V120 H408 V408 Z";

export function Marka({
  className,
  boyut = 36,
}: {
  className?: string;
  /** Kenar uzunluğu, px. */
  boyut?: number;
  /**
   * Geriye uyumluluk: eski çağıranlar `ton` geçiyor. Artık tek düzenleme
   * var; değer okunmaz.
   */
  ton?: "site" | "panel";
}) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 512 512"
      role="img"
      aria-label="MarjPanel"
      className={cn("shrink-0", className)}
    >
      <rect width="512" height="512" rx="112" fill={MARKA_NANE} />
      <path
        d={MARKA_BASAMAK_YOLU}
        fill={MARKA_MUREKKEP}
        stroke={MARKA_MUREKKEP}
        strokeWidth="28"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Kelime işareti. "Marj" tam ağırlıkta, "Panel" bir tık hafif — isim tek
 * parça okunur ama düz bir metin bloğu gibi durmaz.
 *
 * RENK ÇAĞIRANDAN GELİR (`currentColor`): aynı kelime işareti hem beyaz
 * üst çubukta hem mürekkep menüde kullanılıyor; sabit `text-foreground`
 * ikincisinde okunmuyordu. İkinci hece `opacity` ile hafifler — hangi
 * zeminde olursa olsun aynı ilişkiyi korur.
 *
 * `altAd` — alt marka etiketi (ör. "Paket"). Verildiğinde "Panel"den sonra
 * küçük bir hap içinde gösterilir: MarjPanel Paket gibi türetilmiş
 * uygulamalar ana markayı taşır ama kendi kimliğini de belli eder.
 */
export function MarkaYazi({
  className,
  altAd,
}: {
  className?: string;
  altAd?: string;
}) {
  return (
    <span className={cn("tracking-[-0.02em]", className)}>
      <span className="font-extrabold">Marj</span>
      <span className="font-medium opacity-75">Panel</span>
      {altAd && (
        <span className="ml-1.5 inline-flex items-center rounded-full bg-[#12A874]/15 px-1.5 py-px text-[0.58em] font-bold uppercase tracking-[0.08em] text-[#12A874] align-middle">
          {altAd}
        </span>
      )}
    </span>
  );
}

/** İşaret + kelime işareti — kabuklarda kullanılan standart kilit. */
export function MarkaKilit({
  className,
  boyut = 36,
  yaziClass = "text-title-3",
  altAd,
}: {
  className?: string;
  boyut?: number;
  yaziClass?: string;
  altAd?: string;
  /** Geriye uyumluluk; okunmaz. */
  ton?: "site" | "panel";
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Marka boyut={boyut} />
      <MarkaYazi className={yaziClass} altAd={altAd} />
    </span>
  );
}
