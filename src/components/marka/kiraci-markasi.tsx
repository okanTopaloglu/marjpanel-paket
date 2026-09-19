"use client";

import { createContext, useContext } from "react";
import Image from "next/image";
import { Marka, MarkaKilit, MarkaYazi } from "@/components/marka/logo";
import { PLATFORM_MARKASI, type KiraciMarkasi } from "@/lib/kiraci/tipler";
import { cn } from "@/lib/utils";

/**
 * KİRACI MARKASI BİLEŞENLERİ — panelin her yüzeyi markayı BURADAN alır.
 *
 * Kök layout host'tan çözdüğü markayı `MarkaSaglayici` ile indirir; kabuk,
 * giriş kartı, boş durumlar hangi kiracıda olduklarını bilmez, sadece
 * `useMarka()` der. İki kimlik:
 *
 *  · platform → MarjPanel işareti + kelime işareti (logo.tsx), nane vurgusu.
 *  · kiracı   → şirketin yüklediği logo (yoksa adı, kalın metin). Kırmızı,
 *    mavi, ne renkse o logonun içindedir; vurgu rengi nane kalır (DESIGN.md
 *    "Müşteri markası"). MarjPanel her kiracı ekranında ALTYAPI NOTU olarak
 *    durur (`AltyapiNotu`): giriş kartının altında, menünün dibinde, sayfa
 *    alt bilgisinde — küçük ama hep görünür.
 */
const MarkaContext = createContext<KiraciMarkasi>(PLATFORM_MARKASI);

export function MarkaSaglayici({ marka, children }: { marka: KiraciMarkasi; children: React.ReactNode }) {
  return <MarkaContext.Provider value={marka}>{children}</MarkaContext.Provider>;
}

export function useMarka(): KiraciMarkasi {
  return useContext(MarkaContext);
}

/** Yüksekliği sabit, genişliği orantılı logo görseli (`next/image`, optimize edilmez). */
function LogoGorseli({ src, alt, yukseklik, className }: { src: string; alt: string; yukseklik: number; className?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes="100vw"
      unoptimized
      draggable={false}
      className={cn("block w-auto shrink-0 select-none", className)}
      style={{ height: yukseklik, width: "auto", maxWidth: yukseklik * 8 }}
    />
  );
}

/**
 * Kimlik kilidi — logo (ya da ad) + isteğe bağlı "Paket" hapı.
 * `zemin="koyu"` mürekkep menü içindir.
 */
export function KiraciLogo({
  zemin = "acik",
  yukseklik = 20,
  altAd,
  className,
  oncelik = false,
}: {
  zemin?: "acik" | "koyu";
  yukseklik?: number;
  altAd?: string;
  className?: string;
  oncelik?: boolean;
}) {
  const m = useMarka();
  const koyu = zemin === "koyu";
  void oncelik;

  if (m.tur === "platform") {
    return (
      <MarkaKilit
        boyut={Math.round(yukseklik * 1.4)}
        yaziClass={cn("text-title-3", koyu ? "text-ink-foreground" : "text-foreground")}
        altAd={altAd}
        className={className}
      />
    );
  }

  const hap = altAd && (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded-full px-1.5 py-px font-bold uppercase tracking-[0.08em]",
        koyu ? "bg-white/15 text-ink-foreground/80" : "bg-muted text-muted-foreground",
      )}
      style={{ fontSize: Math.max(9, Math.round(yukseklik * 0.55)) }}
    >
      {altAd}
    </span>
  );

  if (koyu) {
    if (m.logoKoyu) {
      return (
        <span className={cn("inline-flex items-center", className)}>
          <LogoGorseli src={m.logoKoyu} alt={m.ad} yukseklik={yukseklik} />
          {hap}
        </span>
      );
    }
    if (m.logoAcik) {
      // Koyu logo yüklenmemiş: açık logo beyaz plakada — koyu zeminde kaybolmasın.
      return (
        <span className={cn("inline-flex items-center", className)}>
          <span className="inline-flex items-center rounded-md bg-white px-2 py-1">
            <LogoGorseli src={m.logoAcik} alt={m.ad} yukseklik={Math.max(12, yukseklik - 6)} />
          </span>
          {hap}
        </span>
      );
    }
  } else if (m.logoAcik) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <LogoGorseli src={m.logoAcik} alt={m.ad} yukseklik={yukseklik} />
        {hap}
      </span>
    );
  }

  // Logo yok: ad kelime işareti gibi.
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span
        className={cn("truncate font-extrabold tracking-[-0.02em]", koyu ? "text-ink-foreground" : "text-foreground")}
        style={{ fontSize: yukseklik * 0.95, lineHeight: 1 }}
      >
        {m.ad}
      </span>
      {hap}
    </span>
  );
}

/** Kare işaret: dar menü, ana ekrana ekle kartı. Kiracıda logo beyaz kare içinde. */
export function KiraciIsaret({ boyut = 28, className }: { boyut?: number; className?: string }) {
  const m = useMarka();
  if (m.tur === "platform" || !m.logoAcik) {
    if (m.tur === "platform") return <Marka boyut={boyut} className={className} />;
    return (
      <span
        aria-label={m.ad}
        role="img"
        className={cn("inline-flex shrink-0 items-center justify-center rounded-[22%] bg-white font-extrabold text-foreground", className)}
        style={{ width: boyut, height: boyut, fontSize: boyut * 0.5 }}
      >
        {m.ad.slice(0, 1).toLocaleUpperCase("tr")}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] bg-white", className)}
      style={{ width: boyut, height: boyut }}
    >
      <Image src={m.logoAcik} alt={m.ad} width={boyut} height={boyut} unoptimized draggable={false} className="h-full w-full object-contain p-[12%]" />
    </span>
  );
}

/**
 * ALTYAPI NOTU — "MarjPanel Paket altyapısı". Kiracı ekranlarında her zaman;
 * platformda gereksiz (zaten MarjPanel'deyiz) ve çizilmez.
 * `belirgin`: giriş kartının altındaki büyük hâli (işaret + kelime işareti).
 */
export function AltyapiNotu({
  zemin = "acik",
  belirgin = false,
  className,
}: {
  zemin?: "acik" | "koyu";
  belirgin?: boolean;
  className?: string;
}) {
  const m = useMarka();
  if (m.tur === "platform") return null;
  const koyu = zemin === "koyu";
  if (belirgin) {
    return (
      <span className={cn("inline-flex flex-col items-center gap-1.5", className)}>
        <span className={cn("text-overline uppercase tracking-[0.12em]", koyu ? "text-ink-foreground/60" : "text-muted-foreground")}>
          altyapı
        </span>
        <MarkaKilit boyut={26} yaziClass={cn("text-title-3", koyu ? "text-ink-foreground" : "text-foreground")} altAd="Paket" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", koyu ? "text-ink-foreground/70" : "text-muted-foreground", className)}>
      <Marka boyut={16} />
      <span className="text-caption">
        <MarkaYazi className="text-caption" /> altyapısı
      </span>
    </span>
  );
}

/**
 * FİLİGRAN — boş yüzeylerde markanın sessiz izi: gri tonda, %40. Kiracıda
 * logo (yoksa ad), platformda MarjPanel kelime işareti.
 */
export function KiraciFiligran({ className, yukseklik = 12, etiket }: { className?: string; yukseklik?: number; etiket?: React.ReactNode }) {
  const m = useMarka();
  return (
    <span aria-hidden="true" className={cn("inline-flex select-none items-center gap-2 text-overline text-muted-foreground/70", className)}>
      {m.tur === "kiraci" && m.logoAcik ? (
        <LogoGorseli src={m.logoAcik} alt="" yukseklik={yukseklik} className="opacity-40 grayscale" />
      ) : (
        <span className="opacity-50">
          <MarkaYazi className="text-caption text-foreground" />
        </span>
      )}
      {etiket && <span className="truncate">{etiket}</span>}
    </span>
  );
}

/** Panel sayfa altı — her sayfanın son satırı; kiracıda MarjPanel altyapı notu sağda. */
export function PanelAltBilgi({ className }: { className?: string }) {
  const m = useMarka();
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-4", className)}>
      <KiraciFiligran yukseklik={11} etiket={m.tur === "kiraci" ? `${m.ad} · Paket paneli` : "Paket paneli"} />
      {m.tur === "kiraci" ? (
        <AltyapiNotu />
      ) : (
        <span className="text-overline text-muted-foreground/70">MarjPanel Paket</span>
      )}
    </div>
  );
}
