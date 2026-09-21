import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { jetonEsitMi } from "@/lib/guvenlik/jeton";

/**
 * GEÇİCİ TANI UCU — giriş sorunu teşhisi.
 *
 * `CRON_SECRET` ile korunur (oturum gerektirmez çünkü sorun zaten giriş
 * yapamamak). PAROLA HASH'İ DÖNDÜRMEZ; yalnız hesabın durumunu gösterir:
 * telefon kayıtlı mı, kilitli mi, kaç hatalı deneme var.
 *
 * Teşhis bitince SİLİNECEK.
 */
export const dynamic = "force-dynamic";

export async function GET(istek: Request): Promise<Response> {
  const gizli = process.env.CRON_SECRET?.trim();
  const baslik = istek.headers.get("authorization") ?? "";
  const onek = "bearer ";
  if (
    !gizli ||
    !baslik.toLowerCase().startsWith(onek) ||
    !jetonEsitMi(baslik.slice(onek.length).trim(), gizli)
  ) {
    return Response.json({ hata: "yetkisiz" }, { status: 401 });
  }

  const satirlar = await db.execute<{
    telefon: string;
    ad: string;
    rol: string;
    aktif: boolean;
    hatali_deneme: number;
    kilit_bitis: string | null;
    parola_uzunluk: number;
    sirket: string;
  }>(sql`
    select k.telefon, k.ad, k.rol, k.aktif, k.hatali_deneme,
           k.kilit_bitis::text as kilit_bitis,
           length(k.parola_hash) as parola_uzunluk,
           s.ad as sirket
    from kullanicilar k
    join sirketler s on s.id = k.sirket_id
    order by k.rol, k.telefon
  `);

  return Response.json({
    simdi: new Date().toISOString(),
    kullanicilar: satirlar,
  });
}
