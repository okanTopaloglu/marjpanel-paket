import type { KullaniciRolu } from "@/lib/db/schema";

/**
 * GİRİŞ ADRESİ KURALI — saf, test edilir.
 *
 * Kiracı izolasyonu veritabanı kapsamıyla bitmez; adres de kapsamın parçası.
 * Alan adı tanımlı bir şirketin kullanıcısı YALNIZ o adresten girer; platform
 * adresinde ya da başka kiracının adresinde reddedilir ve doğru adres
 * söylenir. Alan adı olmayan şirket platform adresinden girer. Süper yönetici
 * her adresten girebilir (destek için kiracının gözünden bakabilsin).
 */
export interface GirisBaglami {
  /** İstek platform adresine mi geldi (paket.marjpanel.com / yerel). */
  hostPlatformMu: boolean;
  /** Normalize host (küçük harf, port yok). */
  host: string;
  rol: KullaniciRolu;
  /** Kullanıcının şirketinin alan adı (normalize) ya da null. */
  sirketAlanAdi: string | null;
  platformHostu: string;
}

export type GirisKarari = { izin: true } | { izin: false; dogruAdres: string };

export function girisKarari(b: GirisBaglami): GirisKarari {
  if (b.rol === "super_admin") return { izin: true };

  if (!b.sirketAlanAdi) {
    return b.hostPlatformMu ? { izin: true } : { izin: false, dogruAdres: `https://${b.platformHostu}` };
  }
  if (b.host === b.sirketAlanAdi) return { izin: true };
  return { izin: false, dogruAdres: `https://${b.sirketAlanAdi}` };
}

/** Host normalize: küçük harf, port ve boşluk yok. Boş/geçersiz → "". */
export function hostNormalize(ham: string | null | undefined): string {
  if (!ham) return "";
  const ilk = ham.split(",")[0]?.trim().toLowerCase() ?? "";
  return ilk.replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Kullanıcının yazdığı alan adını kayıt biçimine indirger; geçersizse null. */
export function alanAdiNormalize(ham: string): string | null {
  let s = ham.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  // Basit hostname doğrulaması: etiketler harf/rakam/tire, en az bir nokta.
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(s)) return null;
  return s;
}

/** Yerel geliştirme / IP / noktasız host platform sayılır. */
export function platformHostuMu(host: string, platformHostu: string): boolean {
  if (!host) return true;
  if (host === platformHostu) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (!host.includes(".")) return true;
  return false;
}
