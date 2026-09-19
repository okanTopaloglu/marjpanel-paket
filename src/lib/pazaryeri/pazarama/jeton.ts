import { PazaryeriBaglantiHatasi, PazaryeriKimlikHatasi } from "../hatalar";
import type { FetchImpl } from "../http";

/**
 * PAZARAMA OAUTH2 JETONU — süreç içi önbellek, clientId başına.
 *
 * `client_credentials` akışı: Basic(clientId:clientSecret) ile token ucu,
 * ~1 saatlik erişim jetonu. Her sayfa için jeton almak hem yavaş hem de
 * hız sınırını boşa yer; jeton `globalThis`te tutulur (HMR'de bile tek kopya)
 * ve süresinden 5 dk önce yenilenir. Şifreli bir sır DEĞİL, kısa ömürlü
 * jeton; veritabanına yazılmaz.
 */
export const PAZARAMA_JETON_URL =
  process.env.PAZARAMA_TOKEN_URL?.trim() || "https://isortagimgiris.pazarama.com/connect/token";

const YENILEME_PAYI_MS = 5 * 60 * 1000;
const VARSAYILAN_SURE_SN = 3600;

interface Kayit {
  jeton: string;
  bitis: number;
}

const genel = globalThis as typeof globalThis & { __pazaramaJeton?: Map<string, Kayit> };
function onbellek(): Map<string, Kayit> {
  if (!genel.__pazaramaJeton) genel.__pazaramaJeton = new Map();
  return genel.__pazaramaJeton;
}

/** Testler ve 401 sonrası tazeleme için. */
export function jetonuUnut(clientId: string): void {
  onbellek().delete(clientId);
}

export async function jetonAl(
  clientId: string,
  clientSecret: string,
  {
    fetchImpl = (g, i) => fetch(g, i),
    jetonUrl = PAZARAMA_JETON_URL,
    simdi = Date.now(),
  }: { fetchImpl?: FetchImpl; jetonUrl?: string; simdi?: number } = {},
): Promise<string> {
  const mevcut = onbellek().get(clientId);
  if (mevcut && mevcut.bitis - YENILEME_PAYI_MS > simdi) return mevcut.jeton;

  const yetki = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");
  let yanit: Response;
  try {
    yanit = await fetchImpl(jetonUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${yetki}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "merchantgatewayapi.fullaccess",
      }).toString(),
      cache: "no-store",
    });
  } catch (hata) {
    throw new PazaryeriBaglantiHatasi("pazarama", hata instanceof Error ? hata.message : String(hata));
  }

  const govde = await yanit.text().catch(() => "");
  if (yanit.status === 400 || yanit.status === 401 || yanit.status === 403) {
    throw new PazaryeriKimlikHatasi("pazarama", yanit.status, govde);
  }
  if (!yanit.ok) {
    throw new PazaryeriBaglantiHatasi("pazarama", `jeton ucu ${yanit.status}: ${govde.slice(0, 160)}`);
  }

  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(govde) as Record<string, unknown>;
  } catch {
    throw new PazaryeriBaglantiHatasi("pazarama", "jeton yanıtı okunamadı (geçersiz JSON).");
  }
  // İki zarf görüldü: { data: { accessToken, expiresIn } } ve { access_token, expires_in }.
  const veri = (j.data && typeof j.data === "object" ? (j.data as Record<string, unknown>) : j) ?? {};
  const jeton = String(veri.accessToken ?? veri.access_token ?? "").trim();
  if (!jeton) throw new PazaryeriKimlikHatasi("pazarama", yanit.status, "jeton yanıtında accessToken yok");
  const sureSn = Number(veri.expiresIn ?? veri.expires_in ?? VARSAYILAN_SURE_SN);
  const bitis = simdi + (Number.isFinite(sureSn) && sureSn > 0 ? sureSn : VARSAYILAN_SURE_SN) * 1000;

  onbellek().set(clientId, { jeton, bitis });
  return jeton;
}
