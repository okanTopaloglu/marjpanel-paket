"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { MobilSheet } from "@/components/ui/mobil-sheet";
import { useMasaustu } from "@/lib/hooks/medya";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ==========================================================================
   TİPLER
   ========================================================================== */

export interface FiltreSecenek {
  deger: string;
  etiket: string;
  /** Seçeneğin yanında gösterilen sayı ("Aktif 128"). */
  adet?: number;
}

/**
 * Bir filtre grubu. `deger`/`onChange` çifti bilerek DIŞARIDAN gelir:
 *
 * URL SENKRONU BU BİLEŞENİN İŞİ DEĞİL. Sayfa hangi filtrenin adres çubuğuna
 * yazılacağını, hangisinin yalnız oturumda kalacağını kendi bilir; bileşen
 * bunu üstlenirse her sayfa aynı router davranışına mahkûm olur ve
 * sunucu bileşeni sınırında `useSearchParams` zorunlu hâle gelir.
 *
 * Kalıcılık için `useKaliciDurum` (bkz. `components/tables/kalici-filtre.tsx`)
 * ile birlikte kullanılır — o kanca da aynı `deger`/`onChange` şeklini verir.
 */
export type FiltreGrubu =
  | {
      anahtar: string;
      baslik: string;
      tip: "tekli";
      secenekler: FiltreSecenek[];
      /** Seçili değer; boş dize "tümü" demektir. */
      deger: string;
      onChange: (deger: string) => void;
    }
  | {
      anahtar: string;
      baslik: string;
      tip: "coklu";
      secenekler: FiltreSecenek[];
      deger: string[];
      onChange: (deger: string[]) => void;
    }
  | {
      anahtar: string;
      baslik: string;
      tip: "arama";
      secenekler?: undefined;
      deger: string;
      onChange: (deger: string) => void;
      yerTutucu?: string;
    }
  | {
      anahtar: string;
      baslik: string;
      tip: "aralik";
      secenekler?: undefined;
      /** `[alt, ust]`; boş dize "sınır yok". */
      deger: [string, string];
      onChange: (deger: [string, string]) => void;
      birim?: string;
    }
  | {
      /**
       * Tek tarih alanı (`YYYY-MM-DD`). "Başlangıç" ve "Bitiş" AYRI gruplar
       * olarak verilir: ikisi tek grup olsaydı çip de tek olurdu ve kullanıcı
       * yalnız bitiş tarihini kaldıramazdı.
       */
      anahtar: string;
      baslik: string;
      tip: "tarih";
      secenekler?: undefined;
      deger: string;
      onChange: (deger: string) => void;
    };

export interface SiralamaSecenegi {
  deger: string;
  etiket: string;
}

/* ==========================================================================
   YARDIMCILAR
   ========================================================================== */

/** `YYYY-MM-DD` değerini çipte okunacak biçime çevirir ("14.03.2026"). */
function tarihOku(iso: string): string {
  const [y, a, g] = iso.split("-");
  return y && a && g ? `${g}.${a}.${y}` : iso;
}

/** Bir grubun şu an filtre uyguluyor olup olmadığı. */
function grupAktifMi(g: FiltreGrubu): boolean {
  switch (g.tip) {
    case "tekli":
    case "arama":
    case "tarih":
      return g.deger !== "";
    case "coklu":
      return g.deger.length > 0;
    case "aralik":
      return g.deger[0] !== "" || g.deger[1] !== "";
  }
}

/**
 * Hapın üstünde gösterilecek özet metin — grup pasifken başlık, aktifken
 * "Başlık: seçim" (çoklu seçimde tek seçiliyse adı, birden çoksa sayısı).
 */
function grupOzeti(g: FiltreGrubu): string {
  if (!grupAktifMi(g)) return g.baslik;
  switch (g.tip) {
    case "tekli": {
      const s = g.secenekler.find((x) => x.deger === g.deger);
      return `${g.baslik}: ${s?.etiket ?? g.deger}`;
    }
    case "coklu": {
      if (g.deger.length === 1) {
        const s = g.secenekler.find((x) => x.deger === g.deger[0]);
        return `${g.baslik}: ${s?.etiket ?? g.deger[0]}`;
      }
      return `${g.baslik} · ${g.deger.length}`;
    }
    case "arama":
      return `${g.baslik}: ${g.deger}`;
    case "tarih":
      return `${g.baslik}: ${tarihOku(g.deger)}`;
    case "aralik": {
      const [a, u] = g.deger;
      const birim = g.birim ? ` ${g.birim}` : "";
      const metin =
        a && u
          ? `${a}${birim} - ${u}${birim}`
          : a
            ? `${a}${birim} ve üzeri`
            : `${u}${birim} ve altı`;
      return `${g.baslik}: ${metin}`;
    }
  }
}

/* ==========================================================================
   GRUP GÖVDESİ — panelde ve sheet'te AYNI işaretleme
   ========================================================================== */

/**
 * ARAMA GİRİŞİ — yerel yazım + GECİKMELİ gönderim (15.09.2026).
 *
 * NEDEN: `value={grup.deger}` doğrudan URL'den geliyordu ve her tuş
 * `onChange` → router.push → sunucudan tam sayfa (RSC) turu tetikliyordu.
 * Kutunun gösterdiği değer o turun CEVABINA bağlı olduğundan yazarken
 * karakterler sunucu hızında akıyordu — kullanıcı "her karakterde sayfa
 * donuyor" diye gördü. Barkod gibi 13 haneli bir değer 13 tam tur demekti.
 *
 * ÇÖZÜM: kutu KENDİ yerel değerini anında gösterir; `onChange` (yani URL +
 * sunucu turu) yazım durduktan 350 ms sonra BİR KEZ çağrılır. Enter erteleme
 * beklemeden gönderir. Dışarıdan gelen `deger` değişirse (çip kaldırıldı,
 * "temizle" basıldı) yerel değer ona uyar — ama YAZIM SIRASINDA gelen eski
 * tur cevapları yazılanı EZMEZ (bekleyen zamanlayıcı varken dış senkron
 * atlanır).
 */
function AramaGirisi({
  deger,
  onChange,
  yerTutucu,
  className,
}: {
  deger: string;
  onChange: (v: string) => void;
  yerTutucu: string;
  className?: string;
}) {
  const [yerel, setYerel] = useState(deger);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gonder = (v: string) => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = null;
    if (v !== deger) onChange(v);
  };

  // Dış değer değişimi (çip/temizle): bekleyen yazım yoksa yerele yansıt.
  useEffect(() => {
    if (zamanlayici.current == null) setYerel(deger);
  }, [deger]);

  // Sökülürken bekleyen zamanlayıcı iptal (geç gelen push sayfayı şaşırtmasın).
  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    [],
  );

  return (
    <input
      type="search"
      value={yerel}
      onChange={(e) => {
        const v = e.target.value;
        setYerel(v);
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = setTimeout(() => gonder(v), 350);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") gonder(yerel);
      }}
      onBlur={() => {
        if (zamanlayici.current) gonder(yerel);
      }}
      placeholder={yerTutucu}
      aria-label={yerTutucu}
      className={cn(
        className ??
          "h-9 w-full rounded-[--radius-kontrol] border border-input bg-card px-3",
        "text-[0.875rem] font-medium text-foreground placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow] duration-gecis ease-out",
        "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
      )}
    />
  );
}

function GrupGovdesi({ grup }: { grup: FiltreGrubu }) {
  if (grup.tip === "arama") {
    return (
      <AramaGirisi
        deger={grup.deger}
        onChange={grup.onChange}
        yerTutucu={grup.yerTutucu ?? grup.baslik}
      />
    );
  }

  if (grup.tip === "tarih") {
    return (
      <input
        type="date"
        value={grup.deger}
        onChange={(e) => grup.onChange(e.target.value)}
        aria-label={grup.baslik}
        className={cn(
          "h-9 w-full rounded-[--radius-kontrol] border border-input bg-card px-3",
          "tabular text-[0.875rem] font-medium text-foreground",
          "transition-[border-color,box-shadow] duration-gecis ease-out",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
        )}
      />
    );
  }

  if (grup.tip === "aralik") {
    const [alt, ust] = grup.deger;
    const ortak = cn(
      "h-9 w-full rounded-[--radius-kontrol] border border-input bg-card px-2.5",
      "tabular text-right text-[0.875rem] font-medium text-foreground",
      "placeholder:text-muted-foreground",
      "transition-[border-color,box-shadow] duration-gecis ease-out",
      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
    );
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={alt}
          onChange={(e) => grup.onChange([e.target.value, ust])}
          placeholder="En az"
          aria-label={`${grup.baslik} en az`}
          className={ortak}
        />
        <span aria-hidden="true" className="text-muted-foreground">
          -
        </span>
        <input
          type="number"
          inputMode="decimal"
          value={ust}
          onChange={(e) => grup.onChange([alt, e.target.value])}
          placeholder="En çok"
          aria-label={`${grup.baslik} en çok`}
          className={ortak}
        />
      </div>
    );
  }

  /* tekli + çoklu: aynı hap ızgarası, farklı seçim mantığı. */
  const coklu = grup.tip === "coklu";
  const secili = (d: string) =>
    coklu ? grup.deger.includes(d) : grup.deger === d;

  return (
    <div className="flex flex-wrap gap-1.5">
      {!coklu && (
        <button
          type="button"
          onClick={() => grup.onChange("")}
          data-secili={grup.deger === "" ? "true" : undefined}
          className="kontrol-hap border border-border"
        >
          Tümü
        </button>
      )}
      {grup.secenekler.map((s) => (
        <button
          key={s.deger}
          type="button"
          aria-pressed={coklu ? secili(s.deger) : undefined}
          data-secili={!coklu && secili(s.deger) ? "true" : undefined}
          onClick={() => {
            if (coklu) {
              grup.onChange(
                secili(s.deger)
                  ? grup.deger.filter((x) => x !== s.deger)
                  : [...grup.deger, s.deger],
              );
            } else {
              grup.onChange(secili(s.deger) ? "" : s.deger);
            }
          }}
          className="kontrol-hap border border-border"
        >
          {s.etiket}
          {s.adet != null && (
            <span className="tabular opacity-70">{s.adet}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Panel/sheet içeriği — başlıklı gruplar (mobil sheet içinde kullanılır). */
function FiltrePaneli({ gruplar }: { gruplar: FiltreGrubu[] }) {
  return (
    <div className="flex flex-col gap-4">
      {gruplar.map((g) => (
        <div key={g.anahtar} className="space-y-2">
          <div className="text-overline text-muted-foreground">{g.baslik}</div>
          <GrupGovdesi grup={g} />
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   GRUP HAPI — masaüstünde her filtre grubu KENDİ hap düğmesi + popover
   ========================================================================== */

/**
 * Tek bir filtre grubunun masaüstü sunumu: nötr/vurgulu hap + altında açılan
 * popover (body'ye portal + fixed konum, `islemler-menusu.tsx`'teki desenin
 * aynısı). Popover içeriği `GrupGovdesi` ile PANELDEKİYLE AYNI — iki ayrı
 * işaretleme sürdürmemek için.
 *
 * Aynı anda tek popover açık kalsın diye açık/kapalı durumu YUKARIDA
 * (`FiltreCubugu`) tek bir `acikGrup` anahtarıyla tutulur; bu bileşen yalnız
 * "benim mi açık" sorusunu sorar.
 */
function GrupHap({
  grup,
  acik,
  onAcikDegistir,
}: {
  grup: FiltreGrubu;
  acik: boolean;
  onAcikDegistir: (acik: boolean) => void;
}) {
  const hapId = useId();
  const sarmalRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [konum, setKonum] = useState<{ top: number; left: number } | null>(
    null,
  );
  const aktif = grupAktifMi(grup);

  // Konum, popover DOM'a commit edildikten sonra ölçülür (bkz. IslemlerMenusu
  // aynı deseni) — böylece gerçek genişliği/yüksekliği okunabilir.
  useLayoutEffect(() => {
    if (!acik) {
      setKonum(null);
      return;
    }
    const r = sarmalRef.current?.getBoundingClientRect();
    if (!r) return;
    const bosluk = 8;
    const genislik = popoverRef.current?.offsetWidth ?? 288;
    setKonum({
      top: r.bottom + bosluk,
      left: Math.min(
        Math.max(bosluk, r.left),
        window.innerWidth - genislik - bosluk,
      ),
    });
  }, [acik]);

  useEffect(() => {
    if (!acik) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onAcikDegistir(false);
    const onDown = (e: PointerEvent) => {
      const hedef = e.target as Node;
      if (
        sarmalRef.current?.contains(hedef) ||
        popoverRef.current?.contains(hedef)
      )
        return;
      onAcikDegistir(false);
    };
    // Sayfa kaydırılınca popover kapanır (tetikleyiciye göre konumlu, asılı
    // kalmasın); popover'ın KENDİ içindeki kaydırma istisnadır.
    const onKaydir = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      onAcikDegistir(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onKaydir, true);
    window.addEventListener("resize", onKaydir);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onKaydir, true);
      window.removeEventListener("resize", onKaydir);
    };
  }, [acik, onAcikDegistir]);

  return (
    <div ref={sarmalRef} className="relative">
      <button
        type="button"
        onClick={() => onAcikDegistir(!acik)}
        aria-expanded={acik}
        aria-controls={acik ? hapId : undefined}
        data-secili={aktif ? "true" : undefined}
        className={cn(
          "press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[--radius-kontrol]",
          "border px-3 text-[0.8125rem] font-semibold",
          "transition-colors duration-dokunma ease-out",
          aktif
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-input bg-card text-foreground [@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
        )}
      >
        <span className="max-w-[12rem] truncate">{grupOzeti(grup)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {acik &&
        createPortal(
          <div
            ref={popoverRef}
            id={hapId}
            role="dialog"
            aria-label={grup.baslik}
            style={{
              position: "fixed",
              top: konum?.top,
              left: konum?.left,
              visibility: konum ? "visible" : "hidden",
            }}
            className={cn(
              "z-[80] w-72 origin-top-left rounded-[--radius] border border-border bg-card p-3 shadow-soft",
              konum && "animate-materialize",
            )}
          >
            <GrupGovdesi grup={grup} />
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ==========================================================================
   FİLTRE ÇUBUĞU
   ========================================================================== */

/**
 * Filtre çubuğu — panelin TEK filtre yüzeyi.
 *
 * · Masaüstü (≥sm): arama kutusu + HER GRUP KENDİ HAPI (popover'lı) + sıralama
 *   + (aktif filtre varsa) Temizle — tek satır, taşarsa sarar. Aktif çip
 *   satırı KALKTI: özet artık hapın kendi etiketinde ("Durum: Satışta"),
 *   ikinci bir gösterim kalabalık ediyordu (15.09.2026 kullanıcı isteği).
 * · Mobil (<sm): DEĞİŞMEDİ — tek "Filtrele (N)" düğmesi + alttan sheet;
 *   dar ekranda gruplar zaten sheet'te derli topluydu.
 *
 * URL senkronu ve localStorage kalıcılığı SAYFANIN işidir (bkz. `FiltreGrubu`).
 */
export function FiltreCubugu({
  gruplar,
  arama,
  siralama,
  onTemizle,
  className,
}: {
  gruplar: FiltreGrubu[];
  /** Çubukta hep açık duran arama kutusu (panelde tekrarlanmaz). */
  arama?: {
    deger: string;
    onChange: (d: string) => void;
    yerTutucu?: string;
  };
  siralama?: {
    deger: string;
    onChange: (d: string) => void;
    secenekler: SiralamaSecenegi[];
  };
  /** Tüm filtreleri sıfırlar. Verilmezse "Temizle" gösterilmez. */
  onTemizle?: () => void;
  className?: string;
}) {
  const panelId = useId();
  const [acik, setAcik] = useState(false);
  const sarmalRef = useRef<HTMLDivElement | null>(null);
  // Sheet portala gider; `md:hidden` sarmalayici ona islemez. Yalniz mobilde cizilir.
  const masaustu = useMasaustu();

  // Masaüstünde hangi GRUBUN popover'ı açık — aynı anda tek popover için tek
  // durum (grup anahtarı ya da hiçbiri açık değilse null).
  const [acikGrup, setAcikGrup] = useState<string | null>(null);

  const aktifSayi = gruplar.filter(grupAktifMi).length;

  const aramaKutusu = arama && (
    <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {/* Gecikmeli gönderim ASIL burada önemli: bu kutu her ekranda hep açık
          ve URL'e bağlıydı — "her karakterde sayfa donuyor" şikâyetinin
          kaynağı (bkz. AramaGirisi gövde notu). */}
      <AramaGirisi
        deger={arama.deger}
        onChange={arama.onChange}
        yerTutucu={arama.yerTutucu ?? "Ara"}
        className={cn(
          "h-9 w-full rounded-[--radius-kontrol] border border-input bg-card pl-8 pr-3",
          "text-[0.875rem] font-medium text-foreground placeholder:text-muted-foreground",
          "transition-[border-color,box-shadow] duration-gecis ease-out",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
        )}
      />
    </div>
  );

  const siralamaSecici = siralama && (
    <select
      value={siralama.deger}
      onChange={(e) => siralama.onChange(e.target.value)}
      aria-label="Sıralama"
      className="kontrol-alan cursor-pointer"
    >
      {siralama.secenekler.map((s) => (
        <option key={s.deger} value={s.deger}>
          {s.etiket}
        </option>
      ))}
    </select>
  );

  if (!masaustu) {
    /* Mobil: eski davranış AYNEN — tek "Filtrele (N)" düğmesi + alttan
       sheet. `useMasaustu` sunucuda/ilk boyamada `false` döndüğü için bu dal
       hidrasyon öncesi de tutarlı çizilir. */
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex flex-wrap items-center gap-2">
          {aramaKutusu}

          <div ref={sarmalRef} className="relative">
            <button
              type="button"
              onClick={() => setAcik((a) => !a)}
              aria-expanded={acik}
              aria-controls={acik ? panelId : undefined}
              className={cn(
                "press inline-flex h-9 cursor-pointer items-center gap-2 rounded-[--radius-kontrol]",
                "border border-input bg-card px-3 text-[0.8125rem] font-semibold text-foreground",
                "transition-colors duration-dokunma ease-out",
                "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
                aktifSayi > 0 && "border-ring",
              )}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
              Filtrele
              {aktifSayi > 0 && (
                <span className="tabular text-[hsl(var(--vurgu-metin))]">
                  ({aktifSayi})
                </span>
              )}
            </button>
          </div>

          {siralamaSecici}
        </div>

        <MobilSheet acik={acik} onKapat={() => setAcik(false)} baslik="Filtrele">
          <div className="px-4 pb-4">
            <FiltrePaneli gruplar={gruplar} />
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => onTemizle?.()}
                disabled={!onTemizle || aktifSayi === 0}
              >
                Temizle
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={() => setAcik(false)}
              >
                Uygula
              </Button>
            </div>
          </div>
        </MobilSheet>
      </div>
    );
  }

  /* Masaüstü: her grup kendi hapı + popover'ı. "arama" tipi hap değildir,
     doğrudan girdi olarak GrupGovdesi ile satırda durur (nadir görülür). */
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {aramaKutusu}

      {gruplar.map((g) =>
        g.tip === "arama" ? (
          <div key={g.anahtar} className="min-w-0 sm:w-48">
            <GrupGovdesi grup={g} />
          </div>
        ) : (
          <GrupHap
            key={g.anahtar}
            grup={g}
            acik={acikGrup === g.anahtar}
            onAcikDegistir={(v) => setAcikGrup(v ? g.anahtar : null)}
          />
        ),
      )}

      {siralamaSecici}

      {onTemizle && aktifSayi > 0 && (
        <button
          type="button"
          onClick={onTemizle}
          className={cn(
            "press cursor-pointer text-[0.8125rem] font-semibold text-muted-foreground underline underline-offset-2",
            "transition-colors duration-dokunma ease-out",
            "[@media(hover:hover)and(pointer:fine)]:hover:text-foreground",
          )}
        >
          Temizle
        </button>
      )}
    </div>
  );
}
