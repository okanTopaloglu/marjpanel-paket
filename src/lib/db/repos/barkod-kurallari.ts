import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { barkodKurallari } from "@/lib/db/schema";
import {
  kuralEslestir,
  type BarkodBilgisi,
  type EslesmeKurali,
} from "@/lib/barkod/coz";

/**
 * BARKOD KURALI REPOSU - okutma akışının en sıcak yolu.
 *
 * Her okutmada kural listesi okunsaydı, saniyede birkaç paket okutan bir
 * depoda aynı 12 satır sürekli sorgulanırdı. Kurallar NADİREN değişir
 * (yönetici ekranından elle), bu yüzden şirket başına 60 saniyelik süreç içi
 * önbellek tutulur. Kural CRUD'u yazıldığında `kuralOnbelleginiTemizle`
 * çağrılır ve değişiklik anında görünür.
 *
 * Önbellek SÜREÇ İÇİDİR: birden çok sunucu süreci varsa her biri kendi
 * kopyasını tutar, en kötü ihtimalle 60 saniye eski kuralla çalışır. Bu bilinçli
 * bir takas - alternatifi her okutmada bir sorgu daha.
 */

const ONBELLEK_OMRU_MS = 60_000;

interface OnbellekGirdisi {
  kurallar: EslesmeKurali[];
  zaman: number;
}

const onbellek = new Map<string, OnbellekGirdisi>();

/**
 * Global (sirket_id IS NULL) + şirkete özel aktif kurallar.
 * `sirketId` alanı korunur: `kurallariSirala` öncelik eşitliğinde şirket
 * kuralını globalin önüne alır.
 */
export async function etkinKurallar(sirketId: string): Promise<EslesmeKurali[]> {
  const satirlar = await db
    .select({
      barkodOneki: barkodKurallari.barkodOneki,
      kaynak: barkodKurallari.kaynak,
      kargoFirmasi: barkodKurallari.kargoFirmasi,
      oncelik: barkodKurallari.oncelik,
      aktif: barkodKurallari.aktif,
      sirketId: barkodKurallari.sirketId,
    })
    .from(barkodKurallari)
    .where(
      and(
        eq(barkodKurallari.aktif, true),
        or(
          isNull(barkodKurallari.sirketId),
          eq(barkodKurallari.sirketId, sirketId),
        ),
      ),
    );

  return satirlar.map((s) => ({
    barkodOneki: s.barkodOneki,
    kaynak: s.kaynak,
    kargoFirmasi: s.kargoFirmasi,
    oncelik: s.oncelik,
    aktif: s.aktif,
    sirketId: s.sirketId,
  }));
}

/** Önbellekli kural listesi. */
async function onbellekliKurallar(sirketId: string): Promise<EslesmeKurali[]> {
  const simdi = Date.now();
  const girdi = onbellek.get(sirketId);
  if (girdi && simdi - girdi.zaman < ONBELLEK_OMRU_MS) return girdi.kurallar;

  const kurallar = await etkinKurallar(sirketId);
  onbellek.set(sirketId, { kurallar, zaman: simdi });
  return kurallar;
}

/**
 * Barkod → kaynak/kargo. Eşleşme SAF fonksiyonda yapılır (`lib/barkod/coz`),
 * burada yalnız kural listesi beslenir.
 */
export async function barkodCoz(
  sirketId: string,
  barkod: string,
): Promise<BarkodBilgisi> {
  return kuralEslestir(await onbellekliKurallar(sirketId), barkod);
}

/**
 * Kural CRUD'u yazdıktan sonra çağrılır. `sirketId` verilmezse tüm önbellek
 * boşalır (global kural değişimi her şirketi etkiler).
 */
export function kuralOnbelleginiTemizle(sirketId?: string): void {
  if (sirketId) onbellek.delete(sirketId);
  else onbellek.clear();
}
