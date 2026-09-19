import { isiYogunlugu } from "@/lib/pano/hesap";
import type { IsiNoktasi } from "@/lib/db/repos/istatistik";

/**
 * SAAT ISI HARİTASI - hafta günü × saat yoğunluğu (7 satır, 24 sütun).
 *
 * NE İŞE YARAR: depo vardiyasını ne zaman güçlendireceğini söyler. "Salı
 * 16:00-18:00 arası her hafta tıkanıyor" bilgisi tek bakışta buradan çıkar,
 * günlük toplamlardan çıkmaz.
 *
 * YOĞUNLUK OPAKLIKLA verilir (`hsl(var(--primary) / a)`), ayrı bir renk
 * skalasıyla değil: DESIGN.md tek vurgu rengi kuralı. Ölçek karekök
 * (`isiYogunlugu`), yoksa tek yoğun saat diğer bütün hücreleri görünmez
 * yapardı.
 *
 * Her hücre `title` taşır - dokunmatikte uzun basınca, masaüstünde üzerine
 * gelince gün/saat/sayı okunur.
 */

const GUN_ADLARI = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
] as const;

const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] as const;

/** Hafta pazartesiyle başlar (Türkiye'de vardiya haftası böyle sayılır). */
const SIRA = [1, 2, 3, 4, 5, 6, 0] as const;

export function IsiHaritasi({
  noktalar,
  gun,
}: {
  noktalar: IsiNoktasi[];
  /** Kaç günlük pencere özetleniyor (başlıkta yazılır). */
  gun: number;
}) {
  const harita = new Map<string, number>();
  let azami = 0;
  for (const n of noktalar) {
    harita.set(`${n.haftaGunu}-${n.saat}`, n.adet);
    if (n.adet > azami) azami = n.adet;
  }

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-title-3">Saat yoğunluğu</h2>
        <p className="text-footnote text-muted-foreground">Son {gun} gün</p>
      </div>

      {azami === 0 ? (
        <p className="mt-3 text-footnote text-muted-foreground">
          Son {gun} günde okutma yok.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto overscroll-x-contain">
          <div className="min-w-[34rem]">
            {/* Saat başlıkları: her 3 saatte bir yazılır, 24 rakam sıkışmasın. */}
            <div
              aria-hidden="true"
              className="mb-1 grid gap-px pl-9"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {Array.from({ length: 24 }, (_, s) => (
                <span
                  key={s}
                  className="tabular text-center text-[10px] font-medium leading-none text-muted-foreground"
                >
                  {s % 3 === 0 ? s : ""}
                </span>
              ))}
            </div>

            {SIRA.map((haftaGunu) => (
              <div key={haftaGunu} className="mb-px flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="w-8 shrink-0 text-right text-[10px] font-semibold text-muted-foreground"
                >
                  {GUN_KISA[haftaGunu]}
                </span>
                <div
                  className="grid flex-1 gap-px"
                  style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                >
                  {Array.from({ length: 24 }, (_, saat) => {
                    const adet = harita.get(`${haftaGunu}-${saat}`) ?? 0;
                    const alfa = isiYogunlugu(adet, azami);
                    return (
                      <div
                        key={saat}
                        title={`${GUN_ADLARI[haftaGunu]} ${String(saat).padStart(2, "0")}:00 - ${adet} paket`}
                        className="h-4 rounded-[2px] border border-border/60"
                        style={{
                          background:
                            alfa > 0
                              ? `hsl(var(--primary) / ${alfa.toFixed(3)})`
                              : "hsl(var(--muted))",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
