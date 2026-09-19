import { PazaryeriBaglantiHatasi, PazaryeriKimlikHatasi } from "../hatalar";
import type { FetchImpl } from "../http";

/**
 * LOGIN WITH AMAZON — refresh token → erişim jetonu, süreç içi önbellek.
 *
 * İki katmanlı kimlik: uygulamanın client id/secret'ı ORTAM DEĞİŞKENİ
 * (MarjPanel Paket'in Amazon'da kayıtlı uygulaması), satıcının refresh
 * token'ı ENTEGRASYON KAYDI (şifreli). Erişim jetonu ~1 saat; 5 dk pay ile
 * yenilenir, refresh token başına önbelleklenir.
 */
export const LWA_URL = process.env.AMAZON_LWA_TOKEN_URL?.trim() || "https://api.amazon.com/auth/o2/token";

export interface LwaUygulama {
  clientId: string;
  clientSecret: string;
}

export function lwaUygulamasi(): LwaUygulama | null {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID?.trim();
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const UYGULAMA_KIMLIGI_YOK =
  "Amazon uygulama kimliği tanımlı değil (AMAZON_LWA_CLIENT_ID / AMAZON_LWA_CLIENT_SECRET). Sunucu ortam değişkenlerine ekleyin.";

const YENILEME_PAYI_MS = 5 * 60 * 1000;
interface Kayit {
  jeton: string;
  bitis: number;
}
const genel = globalThis as typeof globalThis & { __amazonLwa?: Map<string, Kayit> };
function onbellek(): Map<string, Kayit> {
  if (!genel.__amazonLwa) genel.__amazonLwa = new Map();
  return genel.__amazonLwa;
}
export function lwaUnut(refreshToken: string): void {
  onbellek().delete(refreshToken);
}

export async function erisimJetonu(
  refreshToken: string,
  uygulama: LwaUygulama,
  {
    fetchImpl = (g, i) => fetch(g, i),
    url = LWA_URL,
    simdi = Date.now(),
  }: { fetchImpl?: FetchImpl; url?: string; simdi?: number } = {},
): Promise<string> {
  const mevcut = onbellek().get(refreshToken);
  if (mevcut && mevcut.bitis - YENILEME_PAYI_MS > simdi) return mevcut.jeton;

  let yanit: Response;
  try {
    yanit = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken.trim(),
        client_id: uygulama.clientId,
        client_secret: uygulama.clientSecret,
      }).toString(),
      cache: "no-store",
    });
  } catch (hata) {
    throw new PazaryeriBaglantiHatasi("amazon", hata instanceof Error ? hata.message : String(hata));
  }
  const govde = await yanit.text().catch(() => "");
  if (yanit.status === 400 || yanit.status === 401) {
    // LWA yanlış refresh token ya da client secret için 400 `invalid_grant`/`invalid_client` döner.
    throw new PazaryeriKimlikHatasi("amazon", yanit.status, govde);
  }
  if (!yanit.ok) throw new PazaryeriBaglantiHatasi("amazon", `LWA ${yanit.status}: ${govde.slice(0, 160)}`);

  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(govde) as Record<string, unknown>;
  } catch {
    throw new PazaryeriBaglantiHatasi("amazon", "LWA yanıtı okunamadı.");
  }
  const jeton = String(j.access_token ?? "").trim();
  if (!jeton) throw new PazaryeriKimlikHatasi("amazon", yanit.status, "access_token yok");
  const sn = Number(j.expires_in ?? 3600);
  onbellek().set(refreshToken, { jeton, bitis: simdi + (Number.isFinite(sn) && sn > 0 ? sn : 3600) * 1000 });
  return jeton;
}
