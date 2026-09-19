import type { KullaniciRolu } from "@/lib/db/schema";

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
 * SON AKTİF ADMİN KORUMASI — saf fonksiyon.
 *
 * Bir şirketin admin rolündeki TEK aktif kullanıcısı ne rolden düşürülebilir
 * ne pasifleştirilebilir ne de silinebilir — yoksa şirket yönetimsiz kalır.
 * `digerAktifAdminSayisi`, HEDEF kullanıcı hariç aynı şirketteki aktif admin
 * sayısıdır; çağıran bunu tek bir `count(*)` ile hesaplar.
 *
 * Silme işlemi `yeniAktif: false` (kullanıcı artık "aktif admin" değil) ile
 * modellenir — ayrı bir kod yolu gerekmez.
 *
 * `yeniRol`, `"admin"` DIŞINDA herhangi bir değere değişiyorsa (çalışana
 * düşürülse de `super_admin`e yükseltilse de) koruma aynı şekilde işler:
 * kural "rol admin olarak KALSIN" der, "rol düşürülmesin" değil — süper
 * yöneticiye yükseltme de şirketi rol='admin' satırı olmadan bırakır.
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
  const rolDusuyor = girdi.yeniRol !== undefined && girdi.yeniRol !== "admin";
  const pasifOluyor = girdi.yeniAktif === false;
  if (!rolDusuyor && !pasifOluyor) return false;
  return girdi.digerAktifAdminSayisi <= 0;
}
