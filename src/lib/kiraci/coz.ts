import { cache } from "react";
import { headers } from "next/headers";
import { alanAdiIleGetir } from "@/lib/db/repos/sirketler";
import { hostNormalize, platformHostuMu } from "./kural";
import { PLATFORM_MARKASI, type KiraciMarkasi } from "./tipler";

/**
 * HOST → KİRACI MARKASI — yalnız sunucu (DB okur).
 *
 * Middleware Edge'de koştuğu için veritabanına bakamaz; çözüm burada,
 * layout'larda yapılır. `Host` başlığı Coolify/Traefik'ten geldiği gibi
 * okunur; sonuç 60 sn süreç içi önbellekte tutulur (her sayfa isteğinde
 * şirket sorgusu atılmasın). Logo değişince `onbellegiTemizle` çağrılır.
 */
const ONBELLEK_MS = 60_000;

interface Kayit {
  marka: KiraciMarkasi;
  bitis: number;
}
const genel = globalThis as typeof globalThis & { __kiraciOnbellek?: Map<string, Kayit> };
function onbellek(): Map<string, Kayit> {
  if (!genel.__kiraciOnbellek) genel.__kiraciOnbellek = new Map();
  return genel.__kiraciOnbellek;
}

export function kiraciOnbellegiTemizle(): void {
  onbellek().clear();
}

/** Platform adresi `APP_URL`den; tanımsızsa paket.marjpanel.com. */
export function platformHostu(): string {
  try {
    const u = process.env.APP_URL?.trim();
    if (u) return hostNormalize(new URL(u).host);
  } catch {
    /* geçersiz APP_URL */
  }
  return "paket.marjpanel.com";
}

export async function hosttanMarka(hamHost: string | null | undefined): Promise<KiraciMarkasi> {
  const host = hostNormalize(hamHost);
  if (platformHostuMu(host, platformHostu())) return PLATFORM_MARKASI;

  const simdi = Date.now();
  const mevcut = onbellek().get(host);
  if (mevcut && mevcut.bitis > simdi) return mevcut.marka;

  const s = await alanAdiIleGetir(host);
  const marka: KiraciMarkasi = s
    ? {
        tur: "kiraci",
        sirketId: s.id,
        ad: s.markaAdi?.trim() || s.ad,
        logoAcik: s.logoDosya ? `/g/${s.logoDosya}` : null,
        logoKoyu: s.logoKoyuDosya ? `/g/${s.logoKoyuDosya}` : null,
        alanAdi: s.alanAdi,
      }
    : // Tanınmayan alan adı (wildcard DNS her şeyi getirir): platform kimliği.
      PLATFORM_MARKASI;

  onbellek().set(host, { marka, bitis: simdi + ONBELLEK_MS });
  return marka;
}

/** İsteğin markası — istek başına tek çözüm. */
export const kiraciMarkasi = cache(async (): Promise<KiraciMarkasi> => {
  const h = await headers();
  return hosttanMarka(h.get("x-forwarded-host") ?? h.get("host"));
});

/** İsteğin normalize host'u (giriş kapısı için). */
export const istekHostu = cache(async (): Promise<string> => {
  const h = await headers();
  return hostNormalize(h.get("x-forwarded-host") ?? h.get("host"));
});
