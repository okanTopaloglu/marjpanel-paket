import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { adminMi, type Kapsam } from "@/lib/auth/kapsam";
import { kapsamIcinGetir } from "@/lib/db/repos/kullanicilar";

/**
 * YETKİ KAPILARI — sunucu tarafının tek giriş noktası.
 * ---------------------------------------------------------------------------
 * JWT'DEKİ ROL İDDİASINA GÜVENİLMEZ. Jeton iptal edilemez; pasifleştirilen ya
 * da rolü düşürülen kullanıcı jeton ömrü boyunca yetkili KALMAMALIDIR. Bu
 * yüzden her kapı, oturumdaki kimlikle veritabanından TAZE bir `Kapsam` üretir
 * (tek indeksli join). Kiracı izolasyonunun kaynağı da budur: `sirketId`
 * istemciden gelen hiçbir değerden okunmaz.
 *
 * `cache()` istek başına tekilleştirir: aynı render ağacında beş bileşen
 * `panelKapsami()` çağırsa bile tek sorgu atılır.
 */

/** Oturum (yoksa null). İstek başına önbellekli. */
export const oturum = cache(async (): Promise<Session | null> => auth());

export interface PanelOturumu {
  kapsam: Kapsam;
  /** Kabuğun avatarı çizmesi için; `Kapsam`'ın parçası değildir. */
  profilGorsel: string | null;
}

/**
 * Oturum → taze kapsam. Oturum yoksa, kullanıcı silinmişse ya da PASİFSE null.
 * Kabuk `oturumOzeti(kapsam, profilGorsel)` ile istemciye inen özeti üretir.
 */
export const panelOturumu = cache(async (): Promise<PanelOturumu | null> => {
  const o = await oturum();
  const id = o?.user?.id;
  if (!id) return null;

  const satir = await kapsamIcinGetir(id);
  if (!satir || !satir.aktif) return null;
  return { kapsam: satir.kapsam, profilGorsel: satir.profilGorsel };
});

/** Girişli herhangi bir kullanıcı (çalışan dâhil). */
export async function panelKapsami(): Promise<Kapsam | null> {
  return (await panelOturumu())?.kapsam ?? null;
}

/** Yönetim işlemleri: admin veya super_admin. */
export async function adminKapsami(): Promise<Kapsam | null> {
  const k = await panelKapsami();
  return k && adminMi(k.rol) ? k : null;
}

/** Platform yüzeyi (şirketler ekranı): yalnız super_admin. */
export async function superKapsami(): Promise<Kapsam | null> {
  const k = await panelKapsami();
  return k && k.rol === "super_admin" ? k : null;
}

/* ------------------------------------------------------------------ */
/* SAYFA KAPILARI — yetki yoksa yönlendirir (server component'lerde).  */
/* Server action'lar ve route handler'lar yönlendirme DEĞİL hata/durum */
/* döndürmelidir; onlar yukarıdaki `*Kapsami` sürümlerini kullanır.    */
/* ------------------------------------------------------------------ */

export async function panelKapsamiZorunlu(): Promise<Kapsam> {
  const k = await panelKapsami();
  if (!k) redirect("/giris");
  return k;
}

/**
 * Yetkisiz rol /giris'e DEĞİL ana sayfaya gider: kullanıcının oturumu geçerli,
 * yalnız o bölüme hakkı yok. /giris'e atmak "oturumun düştü" yalanı olurdu.
 */
export async function adminKapsamiZorunlu(): Promise<Kapsam> {
  const k = await panelKapsami();
  if (!k) redirect("/giris");
  if (!adminMi(k.rol)) redirect("/");
  return k;
}

export async function superKapsamiZorunlu(): Promise<Kapsam> {
  const k = await panelKapsami();
  if (!k) redirect("/giris");
  if (k.rol !== "super_admin") redirect("/");
  return k;
}
