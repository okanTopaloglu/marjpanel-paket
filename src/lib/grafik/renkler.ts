/**
 * Grafik serisi renkleri.
 *
 * Sıcak paletle uyumlu ama BİRBİRİNDEN AYIRT EDİLEBİLİR bir dizi: seriler
 * yalnız tonla değil, açıklık farkıyla da ayrışır (renk körlüğünde de okunur).
 * Değerler CSS değişkenine bağlıdır — açık/koyu temada kendiliğinden döner.
 */
export const GRAFIK = {
  /** Bizim fiyatımız / ana seri */
  bizim: "hsl(var(--primary))",
  /** Piyasanın en düşüğü — iyi taraf */
  enDusuk: "hsl(var(--success))",
  /** Piyasanın en yükseği — dikkat tarafı */
  enYuksek: "hsl(var(--destructive))",
  /** İkincil ölçek (ör. ortalama fiyat) */
  ikincil: "hsl(var(--cta))",
  /** Nötr referans / ızgara */
  izgara: "hsl(var(--border))",
  eksen: "hsl(var(--muted-foreground))",
} as const;
