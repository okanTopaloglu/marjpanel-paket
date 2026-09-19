import type { KullaniciRolu, OkutmaModu } from "@/lib/db/schema";

/**
 * KAPSAM - her sunucu tarafı işlemin (server action, route handler, sayfa)
 * ilk parametresi. Kiracı izolasyonunun tek kaynağı: repo fonksiyonları
 * `sirketId`'yi buradan alır, istemciden gelen bir şirket kimliğine asla
 * güvenmez. Her istekte DB'den taze üretilir (lib/auth/yetki).
 */
export interface Kapsam {
  kullaniciId: string;
  sirketId: string;
  rol: KullaniciRolu;
  ad: string;
  telefon: string;
  /** Kullanıcının kendi modu; NULL ise şirket varsayılanı geçerli. */
  okutmaModu: OkutmaModu | null;
  sirket: {
    ad: string;
    /** Kiracının giriş adresi (normalize host) ya da null. */
    alanAdi: string | null;
    markaAdi: string | null;
    logoDosya: string | null;
    logoKoyuDosya: string | null;
    varsayilanOkutmaModu: OkutmaModu;
    ozellikler: SirketOzellikleri;
  };
}

export interface SirketOzellikleri {
  faturaPaylas: boolean;
  faturaKesim: boolean;
  mail: boolean;
}

/** Etkin okutma modu: kullanıcı > şirket varsayılanı > hizli. */
export function etkinOkutmaModu(k: Kapsam): OkutmaModu {
  return k.okutmaModu ?? k.sirket.varsayilanOkutmaModu ?? "hizli";
}

export function adminMi(rol: KullaniciRolu): boolean {
  return rol === "admin" || rol === "super_admin";
}

/**
 * İstemciye inen oturum özeti (OturumSaglayici). Kimlik/şirket id'leri
 * içermez; yalnız arayüzün menü ve mod kararı için gereken alanlar.
 */
export interface OturumOzeti {
  ad: string;
  telefon: string;
  rol: KullaniciRolu;
  okutmaModu: OkutmaModu;
  profilGorsel: string | null;
  sirketAd: string;
  ozellikler: SirketOzellikleri;
}

export function oturumOzeti(k: Kapsam, profilGorsel: string | null): OturumOzeti {
  return {
    ad: k.ad,
    telefon: k.telefon,
    rol: k.rol,
    okutmaModu: etkinOkutmaModu(k),
    profilGorsel,
    sirketAd: k.sirket.ad,
    ozellikler: k.sirket.ozellikler,
  };
}
