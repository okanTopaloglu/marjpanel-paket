import { PazaryeriHatasi, PazaryeriKimlikHatasi } from "../hatalar";
import { httpIstemci, type FetchImpl } from "../http";
import type { BaglantiTestSonucu } from "../tipler";
import { UYGULAMA_KIMLIGI_YOK, erisimJetonu, lwaUnut, lwaUygulamasi, type LwaUygulama } from "./lwa";

/**
 * AMAZON SP-API İSTEMCİSİ (Orders v0 + Tokens) — yalnız sunucu.
 * Belge: docs/pazaryeri/amazon.md.
 *
 * Erişim jetonu `x-amz-access-token` başlığında. Kişisel veri (adres/alıcı)
 * için RDT: `ayarlar.piiOnayli` ise sipariş listesi RDT ile çekilir; değilse
 * normal jetonla, adressiz.
 */
export const SPAPI_TABAN = process.env.AMAZON_SPAPI_BASE?.trim() || "https://sellingpartnerapi-eu.amazon.com";
export const SPAPI_SANDBOX = "https://sandbox.sellingpartnerapi-eu.amazon.com";
export const TR_MARKETPLACE_ID = "A33AVAJ2PDY3EV";
export const SAYFA_BOYUTU = 100;

/** getOrderItems 0,5 istek/sn: kalem istekleri arası bekleme. */
export const KALEM_ARASI_MS = 2_100;

export type HamSiparis = Record<string, unknown>;
export type HamKalem = Record<string, unknown>;

export interface AmazonKimlik {
  sellerId: string;
  refreshToken: string;
}

export interface AmazonAyarlar {
  marketplaceId?: string;
  sandbox?: boolean;
  /** RDT ile alıcı/adres çekilsin (uygulamanın PII rolü onaylı olmalı). */
  piiOnayli?: boolean;
  /** FBA (AFN) siparişleri de çekilsin; varsayılan yalnız MFN. */
  fbaDahil?: boolean;
}

export interface SiparisSayfasi {
  siparisler: HamSiparis[];
  nextToken: string | null;
}

export interface AmazonIstemcisi {
  siparisler(p: { baslangic: number; bitis: number; nextToken: string | null }): Promise<SiparisSayfasi>;
  kalemler(amazonOrderId: string): Promise<HamKalem[]>;
  baglantiTest(): Promise<BaglantiTestSonucu>;
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function amazonIstemcisi(
  { sellerId, refreshToken }: AmazonKimlik,
  ayarlar: AmazonAyarlar = {},
  {
    fetchImpl,
    uygulama = lwaUygulamasi(),
    kalemArasiMs = KALEM_ARASI_MS,
  }: { fetchImpl?: FetchImpl; uygulama?: LwaUygulama | null; kalemArasiMs?: number } = {},
): AmazonIstemcisi {
  const taban = ayarlar.sandbox ? SPAPI_SANDBOX : SPAPI_TABAN;
  const marketplaceId = (ayarlar.marketplaceId ?? TR_MARKETPLACE_ID).trim();
  const http = httpIstemci({ platform: "amazon", fetchImpl, basliklar: { Accept: "application/json" } });
  void sellerId; // Orders v0 satıcı kimliğini jetondan bilir; kayıtta hesap ayırt etmek için tutulur.

  async function jeton(): Promise<string> {
    if (!uygulama) throw new PazaryeriKimlikHatasi("amazon", 401, "", UYGULAMA_KIMLIGI_YOK);
    return erisimJetonu(refreshToken, uygulama, { fetchImpl });
  }

  /** Sipariş listesi için RDT; alınamazsa (rol yok) normal jetona düşer. */
  async function siparisJetonu(): Promise<string> {
    const j = await jeton();
    if (!ayarlar.piiOnayli) return j;
    try {
      const r = await http.jsonAl<{ restrictedDataToken?: string }>(`${taban}/tokens/2021-03-01/restrictedDataToken`, {
        method: "POST",
        headers: { "x-amz-access-token": j, "Content-Type": "application/json" },
        body: JSON.stringify({
          restrictedResources: [
            { method: "GET", path: "/orders/v0/orders", dataElements: ["buyerInfo", "shippingAddress"] },
          ],
        }),
      });
      return r.restrictedDataToken?.trim() || j;
    } catch (hata) {
      if (hata instanceof PazaryeriKimlikHatasi) {
        console.warn("[pazaryeri] amazon: RDT alınamadı (PII rolü onaylı değil?); adressiz devam.");
        return j;
      }
      throw hata;
    }
  }

  async function yetkili<T>(url: string, init: RequestInit, j: string): Promise<T> {
    try {
      return await http.jsonAl<T>(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "x-amz-access-token": j } });
    } catch (hata) {
      // 403 Unauthorized: jeton süresi dolmuş olabilir; bir kez tazele.
      if (hata instanceof PazaryeriKimlikHatasi && hata.durumKodu === 403) {
        lwaUnut(refreshToken);
        const yeni = await jeton();
        return http.jsonAl<T>(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "x-amz-access-token": yeni } });
      }
      throw hata;
    }
  }

  function siparisUrl(baslangic: number, bitis: number, nextToken: string | null): string {
    const p = new URLSearchParams();
    if (nextToken) {
      p.set("NextToken", nextToken);
    } else {
      p.set("MarketplaceIds", marketplaceId);
      p.set("LastUpdatedAfter", new Date(baslangic).toISOString());
      // LastUpdatedBefore en az 2 dk geçmişte olmalı (SP-API kuralı).
      p.set("LastUpdatedBefore", new Date(Math.min(bitis, Date.now() - 3 * 60_000)).toISOString());
      if (!ayarlar.fbaDahil) p.set("FulfillmentChannels", "MFN");
      p.set("MaxResultsPerPage", String(SAYFA_BOYUTU));
    }
    return `${taban}/orders/v0/orders?${p.toString()}`;
  }

  return {
    async siparisler({ baslangic, bitis, nextToken }) {
      const j = await siparisJetonu();
      const r = await yetkili<{ payload?: { Orders?: HamSiparis[]; NextToken?: string } }>(
        siparisUrl(baslangic, bitis, nextToken),
        { method: "GET" },
        j,
      );
      return {
        siparisler: Array.isArray(r.payload?.Orders) ? r.payload!.Orders! : [],
        nextToken: r.payload?.NextToken?.trim() || null,
      };
    },

    async kalemler(amazonOrderId) {
      const j = await jeton();
      const r = await yetkili<{ payload?: { OrderItems?: HamKalem[] } }>(
        `${taban}/orders/v0/orders/${encodeURIComponent(amazonOrderId)}/orderItems`,
        { method: "GET" },
        j,
      );
      if (kalemArasiMs > 0) await bekle(kalemArasiMs);
      return Array.isArray(r.payload?.OrderItems) ? r.payload!.OrderItems! : [];
    },

    async baglantiTest(): Promise<BaglantiTestSonucu> {
      if (!uygulama) return { ok: false, mesaj: UYGULAMA_KIMLIGI_YOK };
      try {
        const j = await jeton();
        const p = new URLSearchParams({
          MarketplaceIds: marketplaceId,
          LastUpdatedAfter: new Date(Date.now() - 86_400_000).toISOString(),
          MaxResultsPerPage: "1",
        });
        await yetkili(`${taban}/orders/v0/orders?${p}`, { method: "GET" }, j);
        return { ok: true, mesaj: "Bağlantı başarılı." };
      } catch (hata) {
        if (hata instanceof PazaryeriKimlikHatasi) {
          return { ok: false, mesaj: `Amazon yetki reddi (${hata.durumKodu}): refresh token ya da uygulama kimliği hatalı.` };
        }
        if (hata instanceof PazaryeriHatasi && hata.durumKodu === 429) {
          return { ok: true, mesaj: "Bağlantı kuruldu (hız sınırı, kimlik geçerli)." };
        }
        return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
      }
    },
  };
}
