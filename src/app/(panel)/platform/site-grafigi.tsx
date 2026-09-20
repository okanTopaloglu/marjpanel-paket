import { sayi } from "@/lib/format/sayi";

/**
 * TANITIM SAYFASI GÜNLÜK SERİSİ — iki değerli çubuk: görüntüleme ve
 * etkileşim. Grafik kitaplığı yok (DESIGN.md), düz CSS yükseklikleri.
 *
 * Etkileşim çubuğu görüntülemenin İÇİNE çizilir: "kaç ziyaretin kaçı bir
 * şeye dokundu" sorusu iki ayrı çubuğu karşılaştırmaktan daha hızlı okunur.
 *
 * ERİŞİLEBİLİRLİK: çubuklar `aria-hidden`, aynı veri altta tablo olarak
 * ekran okuyucuya verilir.
 */

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function etiketle(gun: string): string {
  const [, a, g] = gun.split("-").map(Number) as [number, number, number];
  return `${g} ${AYLAR[a - 1] ?? ""}`;
}

export function SiteGrafigi({ seri }: { seri: { gun: string; goruntuleme: number; etkilesim: number }[] }) {
  const azami = seri.reduce((m, n) => Math.max(m, n.goruntuleme), 0);
  const toplam = seri.reduce((t, n) => t + n.goruntuleme, 0);

  if (seri.length === 0) return null;

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-title-3">Günlük ziyaret</h3>
        <p className="tabular text-footnote text-muted-foreground">
          Toplam {sayi(toplam)} görüntüleme
        </p>
      </div>

      <div aria-hidden="true" className="mt-4 flex h-32 items-end gap-1">
        {seri.map((n) => {
          const y = azami > 0 ? Math.round((n.goruntuleme / azami) * 100) : 0;
          const e = n.goruntuleme > 0 ? Math.round((n.etkilesim / n.goruntuleme) * 100) : 0;
          return (
            <div
              key={n.gun}
              title={`${etiketle(n.gun)}: ${n.goruntuleme} görüntüleme, ${n.etkilesim} etkileşim`}
              className="flex min-w-0 flex-1 flex-col justify-end"
              style={{ height: "100%" }}
            >
              <div
                className="relative w-full rounded-t-[3px] bg-muted"
                style={{ height: `${Math.max(y, 2)}%` }}
              >
                {e > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-primary"
                    style={{ height: `${e}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-caption text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" /> görüntüleme
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> etkileşim
        </span>
        <span className="ml-auto tabular">
          {etiketle(seri[0]!.gun)} - {etiketle(seri[seri.length - 1]!.gun)}
        </span>
      </div>

      <table className="sr-only">
        <caption>Günlük tanıtım sayfası ziyaretleri</caption>
        <thead>
          <tr>
            <th scope="col">Gün</th>
            <th scope="col">Görüntüleme</th>
            <th scope="col">Etkileşim</th>
          </tr>
        </thead>
        <tbody>
          {seri.map((n) => (
            <tr key={n.gun}>
              <th scope="row">{etiketle(n.gun)}</th>
              <td>{n.goruntuleme}</td>
              <td>{n.etkilesim}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
