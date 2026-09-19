import { after } from "next/server";
import { jetonEsitMi } from "@/lib/guvenlik/jeton";

/**
 * HARİCİ CRON UCU — süreç içi zamanlayıcının yerine ya da yanında.
 *
 * Sunucusuz/otomatik ölçeklenen bir dağıtımda süreç istekler arasında uykuya
 * dalar ve `setTimeout` zinciri işlemez; orada senkronu dışarıdan bir cron
 * (Vercel Cron, Coolify job, sistem crontab) tetikler. İş kilidi yine
 * veritabanındadır, dolayısıyla cron ile süreç içi zamanlayıcı AYNI ANDA açık
 * olsa bile iki senkron birden koşmaz.
 *
 * KİMLİK: `Authorization: Bearer <CRON_SECRET>`, SABİT ZAMANLI karşılaştırma
 * (`jetonEsitMi`). Gizli anahtar TANIMSIZ ya da BOŞSA uç HER ZAMAN 401 verir -
 * "anahtar yoksa herkese açık" davranışı, unutulan bir env değişkeninin
 * senkronu internete açması demekti.
 *
 * İş `after()` içinde çalışır: cron istemcisi yanıtı hemen alır (çoğu cron
 * servisinin 10 sn zaman aşımı vardır), senkron arka planda sürer.
 */
export const dynamic = "force-dynamic";

function yetkili(istek: Request): boolean {
  const gizli = process.env.CRON_SECRET?.trim();
  if (!gizli) return false;
  const baslik = istek.headers.get("authorization") ?? "";
  const onek = "bearer ";
  if (!baslik.toLowerCase().startsWith(onek)) return false;
  return jetonEsitMi(baslik.slice(onek.length).trim(), gizli);
}

async function calistir(istek: Request): Promise<Response> {
  if (!yetkili(istek)) {
    return Response.json({ ok: false, hata: "Yetkisiz." }, { status: 401 });
  }

  after(async () => {
    try {
      const { tik } = await import("@/lib/senkron/zamanlayici");
      await tik();
    } catch (hata) {
      console.error(
        `[senkron] cron tetiği düştü: ${hata instanceof Error ? hata.message : String(hata)}`,
      );
    }
  });

  return Response.json({ ok: true });
}

/** GET: crontab/curl gibi basit istemciler için. */
export function GET(istek: Request): Promise<Response> {
  return calistir(istek);
}

/** POST: gövdesiz tetik; yan etkili uç için doğru fiil. */
export function POST(istek: Request): Promise<Response> {
  return calistir(istek);
}
