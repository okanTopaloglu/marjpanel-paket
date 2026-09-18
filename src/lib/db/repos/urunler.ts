import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { urunler } from "@/lib/db/schema";

/**
 * ÜRÜN REPOSU.
 *
 * Şimdilik YALNIZ okutma/toplama akışının ihtiyacı var: sipariş satırlarının
 * barkodlarını ürün adı ve görseliyle zenginleştirmek. Ürün yönetimi CRUD'u
 * (listele, içe aktar, senkron, görsel yükle) M4'te bu dosyaya eklenecek;
 * eklenen her fonksiyon `sirketId`'yi açık parametre olarak almalıdır.
 */

export interface UrunOzeti {
  urunAdi: string | null;
  gorselUrl: string | null;
}

/**
 * Barkod → ürün özeti haritası. TEK sorgu: sipariş satırları tek tek
 * sorgulansaydı 20 kalemlik bir toplama listesi 20 gidiş dönüş ederdi.
 * Bulunamayan barkod haritada YOKTUR (çağıran `?? null` ile kendi
 * varsayılanını verir).
 */
export async function barkodlarlaGetir(
  sirketId: string,
  barkodlar: string[],
): Promise<Map<string, UrunOzeti>> {
  const tekil = [...new Set(barkodlar.filter(Boolean))];
  const harita = new Map<string, UrunOzeti>();
  if (tekil.length === 0) return harita;

  const satirlar = await db
    .select({
      barkod: urunler.barkod,
      urunAdi: urunler.urunAdi,
      gorselUrl: urunler.gorselUrl,
    })
    .from(urunler)
    .where(and(eq(urunler.sirketId, sirketId), inArray(urunler.barkod, tekil)));

  for (const s of satirlar) {
    harita.set(s.barkod, { urunAdi: s.urunAdi, gorselUrl: s.gorselUrl });
  }
  return harita;
}
