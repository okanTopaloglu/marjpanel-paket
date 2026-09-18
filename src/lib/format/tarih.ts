/**
 * Tarih/saat gösterimi: her şey Europe/Istanbul. Sunucu ve istemci aynı
 * fonksiyonu kullanır; konteynerin TZ'sine güvenilmez. Veritabanındaki
 * timestamptz değerleri gerçek anlardır; PartnerSys'teki "NoConvert" ikiliği
 * yoktur (Trendyol saat ofseti senkronda, veri yazılırken uygulanır).
 */
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";

type Girdi = Date | string | number | null | undefined;

function tarihe(g: Girdi): Date | null {
  if (g === null || g === undefined || g === "") return null;
  const d = g instanceof Date ? g : new Date(g);
  return Number.isNaN(d.getTime()) ? null : d;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: ISTANBUL_TZ, ...opts });

const F_SAAT = fmt({ hour: "2-digit", minute: "2-digit" });
const F_SAAT_SN = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" });
const F_TARIH = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const F_TARIH_KISA = fmt({ day: "2-digit", month: "short", year: "numeric" });
const F_TARIH_UZUN = fmt({ day: "2-digit", month: "long", year: "numeric" });
const F_TARIH_SAAT = fmt({
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function saat(g: Girdi): string {
  const d = tarihe(g);
  return d ? F_SAAT.format(d) : "-";
}
export function saatSaniye(g: Girdi): string {
  const d = tarihe(g);
  return d ? F_SAAT_SN.format(d) : "-";
}
export function tarih(g: Girdi): string {
  const d = tarihe(g);
  return d ? F_TARIH.format(d) : "-";
}
export function tarihKisa(g: Girdi): string {
  const d = tarihe(g);
  return d ? F_TARIH_KISA.format(d) : "-";
}
export function tarihUzun(g: Girdi): string {
  const d = tarihe(g);
  return d ? F_TARIH_UZUN.format(d) : "-";
}
export function tarihSaat(g: Girdi): string {
  const d = tarihe(g);
  return d ? F_TARIH_SAAT.format(d) : "-";
}

/** İstanbul takvim günü `YYYY-MM-DD` (URL filtreleri, "bugün" hesabı). */
export function gunAnahtari(g: Girdi = new Date()): string {
  const d = tarihe(g) ?? new Date();
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISTANBUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const al = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${al("year")}-${al("month")}-${al("day")}`;
}

/** İstanbul günü için N gün öncesinin anahtarı. */
export function gunAnahtariKaydir(anahtar: string, gun: number): string {
  const [y, m, d] = anahtar.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + gun));
  return t.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` biçimi geçerli mi. */
export function gunAnahtariMi(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/** Göreli kısa metin: "az önce", "5 dk önce", "2 sa önce", yoksa tarih. */
export function goreliZaman(g: Girdi, simdi: Date = new Date()): string {
  const d = tarihe(g);
  if (!d) return "-";
  const sn = Math.round((simdi.getTime() - d.getTime()) / 1000);
  if (sn < 45) return "az önce";
  if (sn < 3600) return `${Math.round(sn / 60)} dk önce`;
  if (sn < 86400) return `${Math.round(sn / 3600)} sa önce`;
  return tarihKisa(d);
}
