"use client";

/**
 * PROFİL GÖRSELİ SIKIŞTIRMA — PartnerSys `client/src/utils/imageCompression.ts`
 * ("compressImage") portu.
 *
 * Farklar:
 *  - Orijinal `canvas.toDataURL` ile base64 metin döner (sunucuya JSON'da
 *    taşınırdı); burada `canvas.toBlob` ile ikili `Blob` dönülür — doğrudan
 *    `FormData`'ya dosya olarak eklenir, base64 şişmesi (yaklaşık %33 daha
 *    büyük gövde) olmaz.
 *  - Tek `azamiKenar` parametresi (orijinaldeki ayrı maxWidth/maxHeight
 *    yerine) uzun kenarı sınırlar; en-boy oranı korunur.
 *
 * TARAYICI-ÖZEL: `document`/`Image`/`canvas` kullanır, yalnız istemci
 * bileşeninden çağrılır.
 */
export interface SikistirmaAyarlari {
  /** Uzun kenarın piksel sınırı. */
  azamiKenar?: number;
  /** JPEG kalitesi (0-1). */
  kalite?: number;
}

const VARSAYILAN_KENAR = 400;
const VARSAYILAN_KALITE = 0.7;

export function gorseliSikistir(
  dosya: File,
  ayarlar: SikistirmaAyarlari = {},
): Promise<Blob> {
  const azamiKenar = ayarlar.azamiKenar ?? VARSAYILAN_KENAR;
  const kalite = ayarlar.kalite ?? VARSAYILAN_KALITE;

  return new Promise((resolve, reject) => {
    const okuyucu = new FileReader();

    okuyucu.onload = (olay) => {
      const img = new Image();

      img.onload = () => {
        let genislik = img.width;
        let yukseklik = img.height;

        // Oranı koru; yalnız UZUN kenarı sınırla.
        if (genislik > yukseklik) {
          if (genislik > azamiKenar) {
            yukseklik = Math.round((yukseklik * azamiKenar) / genislik);
            genislik = azamiKenar;
          }
        } else if (yukseklik > azamiKenar) {
          genislik = Math.round((genislik * azamiKenar) / yukseklik);
          yukseklik = azamiKenar;
        }

        const canvas = document.createElement("canvas");
        canvas.width = genislik;
        canvas.height = yukseklik;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas bağlamı alınamadı."));
          return;
        }
        ctx.drawImage(img, 0, 0, genislik, yukseklik);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Görsel sıkıştırılamadı."));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          kalite,
        );
      };

      img.onerror = () => reject(new Error("Görsel yüklenemedi."));
      img.src = olay.target?.result as string;
    };

    okuyucu.onerror = () => reject(new Error("Dosya okunamadı."));
    okuyucu.readAsDataURL(dosya);
  });
}
