/** Sayı biçimleri — tr-TR, tabular sütunlar için. */
const F_TAM = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const F_ONDALIK = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const F_PARA = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });

export function sayi(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : F_TAM.format(n);
}

export function ondalik(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : F_ONDALIK.format(n);
}

/** Kuruş hassasiyetinde TL; girdi TL cinsinden sayı ya da numeric metin. */
export function para(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? F_PARA.format(v) : "—";
}
