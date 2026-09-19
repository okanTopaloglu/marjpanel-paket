import { GRAFIK } from "@/lib/grafik/renkler";
import type { GunlukNokta } from "@/lib/db/repos/istatistik";

/**
 * GÜNLÜK OKUTMA SERİSİ - son 14 gün, düz CSS çubukları.
 *
 * GRAFİK KİTAPLIĞI YOK (DESIGN.md: hareket CSS'te yaşar, bağımlılık
 * biriktirilmez). Çubuklar yüzde yükseklikli `div`lerdir; renk
 * `lib/grafik/renkler.ts` üzerinden CSS değişkenine bağlıdır, tema
 * değiştiğinde grafik de döner.
 *
 * SIFIR GÜNLER ÇİZİLİR: seride boş gün eksik bırakılsaydı ("o gün hiç okutma
 * olmadı" ile "o gün grafikte yok" ayrılamaz) 14 günlük ritim yanlış okunurdu.
 * Sıfır günün yerinde ince bir taban çizgisi kalır.
 *
 * ERİŞİLEBİLİRLİK: aynı veri ekran okuyucuya tablo olarak da verilir; çubuklar
 * `aria-hidden`. Fareyle üzerine gelen `title` ile günü ve sayıyı görür.
 */

const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] as const;

/** `YYYY-MM-DD` → "14 Eyl Pzt" (tarayıcı/sunucu farkı olmadan, saf metin). */
function etiketle(gun: string): { gunAy: string; haftaGunu: string } {
  const [y, a, g] = gun.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(y, a - 1, g));
  const aylar = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ];
  return {
    gunAy: `${g} ${aylar[a - 1] ?? ""}`,
    haftaGunu: GUN_KISA[d.getUTCDay()] ?? "",
  };
}

export function GunlukGrafik({ seri }: { seri: GunlukNokta[] }) {
  const azami = seri.reduce((m, n) => Math.max(m, n.adet), 0);
  const toplam = seri.reduce((t, n) => t + n.adet, 0);

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-title-3">Son {seri.length} gün</h2>
        <p className="tabular text-footnote text-muted-foreground">
          Toplam {toplam.toLocaleString("tr-TR")} paket
        </p>
      </div>

      {toplam === 0 ? (
        <p className="mt-3 text-footnote text-muted-foreground">
          Son {seri.length} günde okutma yok.
        </p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mt-4 flex h-32 items-end gap-1 border-b"
            style={{ borderColor: GRAFIK.izgara }}
          >
            {seri.map((n) => {
              const oran = azami > 0 ? n.adet / azami : 0;
              const etiket = etiketle(n.gun);
              return (
                <div
                  key={n.gun}
                  title={`${etiket.gunAy} ${etiket.haftaGunu}: ${n.adet} paket`}
                  className="flex h-full min-w-0 flex-1 items-end"
                >
                  <div
                    className="w-full rounded-t-[3px] transition-[height] duration-gecis ease-out"
                    style={{
                      // En küçük dolu çubuk bile görünür kalsın (2px taban).
                      height: n.adet > 0 ? `max(2px, ${Math.round(oran * 100)}%)` : "2px",
                      background: n.adet > 0 ? GRAFIK.bizim : GRAFIK.izgara,
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div aria-hidden="true" className="mt-1.5 flex gap-1">
            {seri.map((n, i) => {
              const etiket = etiketle(n.gun);
              // Dar ekranda her günün etiketi sığmaz: ikide bir yazılır.
              const yaz = i % 2 === seri.length % 2;
              return (
                <div
                  key={n.gun}
                  className="tabular min-w-0 flex-1 text-center text-[10px] font-medium leading-tight text-muted-foreground"
                >
                  <span className={yaz ? undefined : "sm:inline hidden"}>
                    {etiket.gunAy}
                  </span>
                </div>
              );
            })}
          </div>

          <table className="sr-only">
            <caption>Son {seri.length} günün okutma sayıları</caption>
            <thead>
              <tr>
                <th scope="col">Gün</th>
                <th scope="col">Paket</th>
              </tr>
            </thead>
            <tbody>
              {seri.map((n) => (
                <tr key={n.gun}>
                  <th scope="row">{n.gun}</th>
                  <td>{n.adet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
