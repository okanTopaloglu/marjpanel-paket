import { headers } from "next/headers";
import { superKapsami } from "@/lib/auth/yetki";
import { kiraciMarkasi, istekHostu, platformHostu } from "@/lib/kiraci/coz";

/**
 * TANI UCU — yalnız süper yönetici, geçici teşhis için.
 *
 * Kök yolda beklenen yönlendirmenin neden çalışmadığını anlamak için host
 * çözümünü olduğu gibi gösterir. Kişisel veri döndürmez.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const k = await superKapsami();
  if (!k) return Response.json({ hata: "yetkisiz" }, { status: 403 });

  const h = await headers();
  const marka = await kiraciMarkasi();

  return Response.json({
    rol: k.rol,
    host_basligi: h.get("host"),
    x_forwarded_host: h.get("x-forwarded-host"),
    istek_hostu: await istekHostu(),
    platform_hostu: platformHostu(),
    marka_turu: marka.tur,
    marka_ad: marka.ad,
    app_url: process.env.APP_URL ?? null,
  });
}
