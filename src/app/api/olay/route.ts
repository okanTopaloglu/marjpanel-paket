import { after } from "next/server";
import { olayYaz } from "@/lib/db/repos/site-olaylari";
import { siteOlayiTuruEnum } from "@/lib/db/schema";
import { istekHostu, platformHostu } from "@/lib/kiraci/coz";
import { platformHostuMu } from "@/lib/kiraci/kural";

/**
 * OLAY UCU — tanıtım sayfasının analitiği.
 *
 * KİŞİSEL VERİ YAZILMAZ: IP, çerez, oturum kimliği ya da parmak izi yok.
 * Ziyaretçiyi tekilleştiren hiçbir alan tutulmadığı için çerez onayı
 * gerekmez. Yönlendiren yalnız ALAN ADI olarak saklanır - tam URL arama
 * sorgusu taşıyabilir ve o kişisel veri sayılır.
 *
 * `after()`: yanıt hemen döner, yazma arkada sürer. Ziyaretçi bir bağlantıya
 * tıklarken analitik yazmasını beklemesin.
 *
 * AÇIK UÇ (oturum istemez) ama YALNIZ PLATFORM HOST'UNDA çalışır ve gövdesi
 * beyaz listeyle sınırlıdır; kötü niyetli biri en fazla sayaç şişirir,
 * veritabanına serbest metin yazamaz.
 */
export const dynamic = "force-dynamic";

/** Alan başına azami uzunluk - şişkin gövde veritabanına inmesin. */
const AZAMI = 120;

function kirp(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, AZAMI) : null;
}

export async function POST(istek: Request): Promise<Response> {
  const host = await istekHostu();
  if (!platformHostuMu(host, platformHostu())) {
    return Response.json({ ok: false }, { status: 404 });
  }

  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const g = (govde ?? {}) as Record<string, unknown>;
  const tur = typeof g.tur === "string" ? g.tur : "";
  if (!(siteOlayiTuruEnum.enumValues as readonly string[]).includes(tur)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  /*
   * Yönlendiren ALAN ADINA indirgenir. Kendi alan adımız "doğrudan" sayılır:
   * sayfa içi gezinme yönlendiren trafik değildir.
   */
  let yonlendiren: string | null = null;
  const ham = kirp(g.yonlendiren);
  if (ham) {
    try {
      const h = new URL(ham).hostname.replace(/^www\./, "");
      yonlendiren = h && !h.endsWith("marjpanel.com") ? h : null;
    } catch {
      /* geçersiz URL - yok say */
    }
  }

  const ua = istek.headers.get("user-agent") ?? "";
  const cihaz = /mobile|android|iphone|ipad/i.test(ua) ? "mobil" : "masaustu";

  after(async () => {
    try {
      await olayYaz({
        tur: tur as (typeof siteOlayiTuruEnum.enumValues)[number],
        yol: kirp(g.yol) ?? "/",
        etiket: kirp(g.etiket),
        yonlendiren,
        kaynak: kirp(g.kaynak),
        kampanya: kirp(g.kampanya),
        cihaz,
      });
    } catch (hata) {
      // Analitik ASLA ziyaretçiyi etkilemez; hata yutulur ve loglanır.
      console.warn(`[olay] yazılamadı: ${hata instanceof Error ? hata.message : String(hata)}`);
    }
  });

  return new Response(null, { status: 204 });
}
