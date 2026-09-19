import type { KullaniciRolu } from "@/lib/db/schema";

/** Yönetim yetkisi taşıyan roller: şirketi admin de super_admin de yönetebilir. */
export function yoneticiRoluMu(rol: KullaniciRolu): boolean {
  return rol === "admin" || rol === "super_admin";
}

/**
 * KULLANICI İŞ KURALLARI — SAF MODÜL (DB bağlantısı YOK).
 *
 * `repos/kullanicilar.ts`'in kullandığı hata sınıfı ve "son aktif admin"
 * kuralı BİLEREK ayrı bir dosyada: `repos/kullanicilar.ts`, modül
 * yüklenirken `lib/db/client`'ı (dolayısıyla `DATABASE_URL`'i) içe aktarır;
 * bu dosya öyle bir bağımlılık taşımadığı için birim testleri DB/env
 * olmadan, saf fonksiyon olarak çalışır.
 */

export type KullaniciHataKodu =
  | "bulunamadi"
  | "yetkisiz"
  | "yetkisiz-rol"
  | "kendi-rolu"
  | "kendini-silemez"
  | "son-admin";

/**
 * İş kuralı ihlalleri (yetki/son-admin/kendini-silme) — DB hatası DEĞİL.
 * Server action bu hatayı yakalayıp `hata.message`'ı doğrudan kullanıcıya
 * gösterir; mesajlar bu yüzden zaten Türkçe ve son kullanıcıya uygundur.
 */
export class KullaniciIslemHatasi extends Error {
  constructor(
    public readonly kod: KullaniciHataKodu,
    mesaj: string,
  ) {
    super(mesaj);
    this.name = "KullaniciIslemHatasi";
  }
}

/**
 * SON AKTİF YÖNETİCİ KORUMASI — saf fonksiyon.
 *
 * Bir şirketin yönetici rolündeki (admin VEYA super_admin) TEK aktif
 * kullanıcısı ne çalışana düşürülebilir ne pasifleştirilebilir ne de
 * silinebilir — yoksa şirket yönetimsiz kalır. `digerAktifAdminSayisi`,
 * HEDEF hariç aynı şirketteki aktif yönetici sayısıdır; çağıran bunu tek bir
 * `count(*)` ile hesaplar.
 *
 * Silme işlemi `yeniAktif: false` ile modellenir — ayrı kod yolu gerekmez.
 * admin ↔ super_admin geçişi yönetim yetkisini korur, koruma devreye girmez.
 */
export function sonAdminKorumasiIhlaliMi(girdi: {
  /** Hedef, DEĞİŞİKLİKTEN ÖNCE şirketin aktif bir admin'i miydi? */
  hedefSuAnAktifAdminMi: boolean;
  /** Aynı şirkette, hedef hariç, aktif admin sayısı. */
  digerAktifAdminSayisi: number;
  /** Güncellemede `rol` alanı gönderildiyse yeni değeri. */
  yeniRol?: KullaniciRolu;
  /** Güncellemede `aktif` alanı gönderildiyse yeni değeri. */
  yeniAktif?: boolean;
}): boolean {
  if (!girdi.hedefSuAnAktifAdminMi) return false;
  const rolDusuyor = girdi.yeniRol !== undefined && !yoneticiRoluMu(girdi.yeniRol);
  const pasifOluyor = girdi.yeniAktif === false;
  if (!rolDusuyor && !pasifOluyor) return false;
  return girdi.digerAktifAdminSayisi <= 0;
}
