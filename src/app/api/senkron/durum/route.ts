import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pazaryeriSiparisleri } from "@/lib/db/schema";
import { adminKapsami } from "@/lib/auth/yetki";
import { durumOzeti } from "@/lib/db/repos/senkron-isleri";
import { sekmeKosulu } from "@/lib/siparis/sekme-sql";

/**
 * SENKRON DURUMU — entegrasyonlar sayfasındaki ilerleme kartı bunu yoklar.
 *
 * Sayfa yenilemek yerine uç yoklanır: senkron 30 sn'de bir çalışır ve
 * kullanıcı "şimdi senkronla"ya bastıktan sonra ilerlemeyi canlı görmek ister.
 * `no-store` ZORUNLU - ara katman bir kez önbelleğe alırsa çubuk donar ve iş
 * bitse de "çalışıyor" görünür.
 *
 * Yönlendirme YOK: bu bir veri ucu, yetkisiz istek 401 alır (sunucu bileşeni
 * olsaydı /giris'e yönlendirirdi; JSON bekleyen istemciye HTML dönmez).
 */
export const dynamic = "force-dynamic";

const BASLIKLAR = { "Cache-Control": "no-store" } as const;

export async function GET(): Promise<Response> {
  const kapsam = await adminKapsami();
  if (!kapsam) {
    return Response.json(
      { ok: false, hata: "Yetkisiz." },
      { status: 401, headers: BASLIKLAR },
    );
  }

  const [ozet, [sayim]] = await Promise.all([
    durumOzeti(kapsam.sirketId),
    db
      .select({ adet: sql<number>`count(*)::int` })
      .from(pazaryeriSiparisleri)
      .where(
        and(
          eq(pazaryeriSiparisleri.sirketId, kapsam.sirketId),
          sql`(${sql.raw(sekmeKosulu("bekleyen"))})`,
        ),
      ),
  ]);

  return Response.json(
    { ok: true, ...ozet, bekleyenSiparis: sayim?.adet ?? 0 },
    { headers: BASLIKLAR },
  );
}
