import { isiYogunlugu } from "@/lib/pano/hesap";
import { sayi } from "@/lib/format/sayi";

const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Gün × saat ısı haritası — nane tonlarında, dolgu yalnız yoğunluk gösterir. */
export function IsiHaritasi({ noktalar }: { noktalar: { gun: number; saat: number; adet: number }[] }) {
  const azami = Math.max(0, ...noktalar.map((n) => n.adet));
  const harita = new Map(noktalar.map((n) => [`${n.gun}-${n.saat}`, n.adet]));
  return (
    <div className="overflow-x-auto rounded-[--radius] border border-border bg-card p-3">
      <div className="grid min-w-[640px] gap-1" style={{ gridTemplateColumns: "3rem repeat(24, minmax(0, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }, (_, s) => (
          <div key={s} className="tabular text-center text-[10px] text-muted-foreground">
            {s}
          </div>
        ))}
        {GUNLER.map((g, gi) => (
          <div key={g} className="contents">
            <div className="text-caption text-muted-foreground">{g}</div>
            {Array.from({ length: 24 }, (_, s) => {
              const adet = harita.get(`${gi}-${s}`) ?? 0;
              const yogunluk = azami > 0 ? isiYogunlugu(adet, azami) : 0;
              return (
                <div
                  key={s}
                  title={`${g} ${s}:00 · ${sayi(adet)} paket`}
                  className="aspect-square rounded-[3px] border border-border/60"
                  style={{ backgroundColor: `hsl(160 80% 36% / ${adet === 0 ? 0 : 0.15 + yogunluk * 0.85})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
