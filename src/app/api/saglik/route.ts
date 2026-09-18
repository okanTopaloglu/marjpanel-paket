import { client } from "@/lib/db/client";

/**
 * SAĞLIK UCU — konteyner/yük dengeleyici sondası. OTURUM İSTEMEZ (bilerek):
 * sondayı atan altyapı çerez taşımaz. Dışarı hiçbir iç bilgi sızmaz; yalnız
 * "veritabanına bir sorgu gidip geldi mi" cevabı döner.
 *
 * `force-dynamic`: derleme sırasında önbelleğe alınırsa uç hep "ok" der ve
 * sonda hiçbir şey ölçmemiş olur.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const zaman = new Date().toISOString();
  try {
    await client`select 1`;
    return Response.json({ ok: true, db: true, zaman });
  } catch {
    // Hata metni DÖNMEZ: bağlantı dizesi/sunucu adı sızabilir.
    return Response.json({ ok: false, db: false, zaman }, { status: 503 });
  }
}
