import type { Config } from "tailwindcss";

/**
 * MarjPanel Paket - "Mürekkep & Nane" tasarım sistemi.
 *
 * MarjPanel'in tasarım sisteminin depo paket okutma uygulamasına uyarlanmış
 * kopyası. Yazı tipi: Manrope Variable, tek aile. Panelde başlık/gövde/etiket/
 * veri hepsi aynı aileden; ayrım ağırlık, boyut ve tracking ile kurulur (ürün
 * arayüzü display/body ayrımı istemez).
 *
 * Yazı tipi PAKETTEN gelir (`@fontsource-variable/manrope`), Google'dan
 * değil: Docker imajı ağsız derlenir ve `next/font/google` orada patlar.
 *
 * Renk sistemi ve gerekçeleri: /DESIGN.md
 */

/** Manrope yüklenemezse düşülecek sistem yığını. */
const sistemSans = [
  "-apple-system",
  "BlinkMacSystemFont",
  "Segoe UI Variable Text",
  "Segoe UI",
  "Roboto",
  "Ubuntu",
  "Cantarell",
  "Noto Sans",
  "system-ui",
  "sans-serif",
  "Apple Color Emoji",
  "Segoe UI Emoji",
];

const config: Config = {
  /**
   * `darkMode` tanımı DURUYOR ama `.dark` sınıfı hiçbir yere KONMAZ: koyu
   * tema kaldırıldı (gerekçe: DESIGN.md "Tema"). Tanımın kalması, kalan
   * birkaç `dark:` yardımcı sınıfının derleme hatası vermemesini sağlar.
   */
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        /** Nane — birincil eylem, seçili durum, durum göstergesi. */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        /** Mürekkep — menü zemini, `ink` buton varyantı. */
        ink: {
          DEFAULT: "hsl(var(--menu))",
          aktif: "hsl(var(--menu-aktif))",
          foreground: "hsl(var(--menu-foreground))",
        },
        /** `secondary` = mürekkep (eski tüketiciler için ad korunur). */
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        /**
         * `cta` ARTIK AYRI BİR RENK DEĞİL — tek vurgu kuralı gereği vurguya
         * düşer. Sekiz dosyada `bg-cta/5`, `border-cta` gibi kullanımlar var;
         * token'ı silmek onları kırardı.
         */
        cta: {
          DEFAULT: "hsl(var(--cta))",
          foreground: "hsl(var(--cta-foreground))",
        },

        /* --- Durum: tam ton + adı konmuş soluk zemin ------------------
           Soluk zeminler opaklık varyantı DEĞİL ayrı token: opaklık altındaki
           zemine göre kayar, adı konmuş bir ton kaymaz. */
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },
        /** "Bilinmiyor" — veri yok, durum okunamadı. Nötr, uyarı değil. */
        unknown: {
          DEFAULT: "hsl(var(--unknown))",
          soft: "hsl(var(--unknown-soft))",
        },

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },

      /**
       * TEK KÖŞE ÖLÇEĞİ: kart 12px · buton/giriş 9px · çip/rozet 999px ·
       * sheet 16px. Tailwind'in `rounded-lg`/`rounded-xl`/`rounded-2xl`
       * adları panelde yüzlerce yerde geçtiği için bu üç ad da KART
       * yarıçapına düşer — sayfaları tek tek düzeltmeden ölçek tekleşir.
       */
      borderRadius: {
        sm: "0.375rem",
        md: "var(--radius-kontrol)", // 9px — buton, giriş
        lg: "var(--radius-kontrol)", // 9px
        xl: "var(--radius)", // 12px — kart
        "2xl": "var(--radius)", // 12px — kart
        "3xl": "var(--radius-sheet)", // 16px — sheet
      },

      fontFamily: {
        sans: ["Manrope Variable", ...sistemSans],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Cascadia Mono",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },

      /**
       * TEK GÖLGE KADEMESİ. Beş ad da aynı gölgeye düşer — eski tüketiciler
       * (`shadow-soft`, `shadow-xs`, `shadow-glow`…) kırılmasın diye adlar
       * korunur, değerler tekleşir.
       */
      boxShadow: {
        xs: "var(--shadow-xs)",
        soft: "var(--shadow)",
        "soft-lg": "var(--shadow)",
        "soft-xl": "var(--shadow)",
        glow: "var(--shadow)",
        inset: "var(--shadow-inset)",
      },

      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },

      transitionDuration: {
        // Hareket dilinin üç süresi (DESIGN.md "Hareket").
        dokunma: "120ms",
        gecis: "200ms",
        yuzey: "320ms",
      },

      spacing: {
        "safe-t": "env(safe-area-inset-top, 0px)",
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        // Mobil alt sekme çubuğu yüksekliği + güvenli alan
        tabbar: "calc(4rem + env(safe-area-inset-bottom, 0px))",
      },

      minHeight: {
        // Dokunma hedefi en az 44px
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s var(--ease-out)",
        "accordion-up": "accordion-up 0.2s var(--ease-out)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
