import type { LucideIcon } from "lucide-react";
import { Inbox, PackageCheck, Truck, AlarmClock } from "lucide-react";
import type { AkisSayaci, SiparisAkisi } from "@/lib/db/repos/siparis-akisi";
import { cn } from "@/lib/utils";

/**
 * SİPARİŞ AKIŞI KARTLARI — gelen → hazırlanan → kargoya verilen, artı
 * "kargoya verilmesi gereken" (bugünkü kesim saatine göre).
 *
 * Her kartta entegrasyon kırılımı ROZET olarak durur: depo "hangi mağaza
 * birikti" sorusunu kartı açmadan görsün. Grafik yok, sayı + rozet.
 */
const tr = new Intl.NumberFormat("tr-TR");

function Kirilim({ sayac, ton }: { sayac: AkisSayaci; ton: "notr" | "uyari" }) {
  if (sayac.kirilim.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {sayac.kirilim.slice(0, 6).map((k) => (
        <span
          key={k.ad}
          className={cn(
            "tabular inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-semibold",
            ton === "uyari" ? "border-warning/40 bg-warning-soft text-warning" : "border-border bg-muted/60 text-foreground",
          )}
        >
          <span className="max-w-[10rem] truncate font-medium">{k.ad}</span>
          <span>{tr.format(k.adet)}</span>
        </span>
      ))}
    </div>
  );
}

function Kart({
  etiket,
  sayac,
  dipnot,
  ikon: Ikon,
  vurgu,
}: {
  etiket: string;
  sayac: AkisSayaci;
  dipnot: string;
  ikon: LucideIcon;
  vurgu?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[--radius] border bg-card p-4 sm:p-5",
        vurgu && sayac.toplam > 0 ? "border-warning/50 bg-warning-soft/30" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-overline text-muted-foreground">{etiket}</div>
          <div className={cn("tabular text-display leading-none", vurgu && sayac.toplam > 0 ? "text-warning" : "text-foreground")}>
            {tr.format(sayac.toplam)}
          </div>
          <div className="text-footnote text-muted-foreground">{dipnot}</div>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            vurgu && sayac.toplam > 0 ? "bg-warning text-white" : "bg-accent text-[hsl(var(--vurgu-parlak))]",
          )}
        >
          <Ikon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <Kirilim sayac={sayac} ton={vurgu ? "uyari" : "notr"} />
    </div>
  );
}

export function SiparisAkisiKartlari({ akis, aralikEtiketi }: { akis: SiparisAkisi; aralikEtiketi: string }) {
  const kesim = `${String(akis.kesimSaati).padStart(2, "0")}:00`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kart etiket="Gelen siparişler" sayac={akis.gelen} dipnot={aralikEtiketi} ikon={Inbox} />
      <Kart etiket="Hazırlanan" sayac={akis.hazirlanan} dipnot={`Okutulup hazır işaretlenen · ${aralikEtiketi}`} ikon={PackageCheck} />
      <Kart etiket="Kargoya verilen" sayac={akis.kargoyaVerilen} dipnot={`Pazaryeri "kargoda" dedi · ${aralikEtiketi}`} ikon={Truck} />
      <Kart
        etiket="Kargoya verilmesi gereken"
        sayac={akis.sevkGereken}
        dipnot={`Kesim ${kesim} öncesi gelen, henüz çıkmayan · kesim sonrası ${tr.format(akis.kesimSonrasi)}`}
        ikon={AlarmClock}
        vurgu
      />
    </div>
  );
}
