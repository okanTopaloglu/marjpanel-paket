import { readFile, stat } from "node:fs/promises";
import {
  dosyaAdiGecerliMi,
  dosyaIcerikTuru,
  dosyaYolu,
} from "@/lib/depo/dosya";

// `fs` erişimi ister — Edge çalışma zamanında node:fs yoktur.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /g/<dosya> — panele yüklenen profil/ürün görsellerinin servis ucu.
 *
 * Güvenlik oturumdan değil DOSYA ADININ BEYAZ LİSTELİ OLUŞUNDAN gelir —
 * `dosyaYolu` path traversal'ı ve izinsiz uzantıyı reddeder; bu route hiçbir
 * ek doğrulama eklemez, tek doğruluk kaynağı `lib/depo/dosya.ts`tir.
 *
 * BULUNAMAYAN HER ŞEY 404'TÜR: geçersiz ad da, diskte olmayan dosya da aynı
 * yanıtı alır.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dosya: string }> },
) {
  const { dosya } = await params;

  if (!dosya || !dosyaAdiGecerliMi(dosya)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const yol = dosyaYolu(dosya);
  try {
    await stat(yol);
    const icerik = await readFile(yol);
    return new Response(new Uint8Array(icerik), {
      status: 200,
      headers: {
        "content-type": dosyaIcerikTuru(dosya),
        // Dosya adı rastgele ve İÇERİK DEĞİŞMEZ (yeniden yükleme yeni ad
        // üretir) — bir yıl + immutable güvenlidir.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
}
