import {
  Clock,
  Inbox,
  Package,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/panel/avatar";
import { StatKarti } from "@/components/panel/stat-karti";
import { payYuzdesi } from "@/lib/pano/hesap";
import type { AralikOzeti, GelismisOzet, KirilimPayi } from "@/lib/db/repos/istatistik";

/**
 * PANO SAYILARI - dört özet kartı ve üç kırılım.
 *
 * GRAFİK KİTAPLIĞI YOK. Kırılımlar basit CSS çubuklarıdır: değerler bir
 * yüzdeye indirgenip genişlik olarak verilir. Bir pasta grafik için 40 kB'lık
 * bir bağımlılık taşımak, "hangi çalışan kaç paket okuttu" sorusuna cevap
 * vermiyor - sıralı liste veriyor, üstelik ekran okuyucuda da okunuyor.
 *
 * Sayılar `tabular` (DESIGN.md): kartlar yan yana dururken rakamlar hizasını
 * korur.
 */

const tr = new Intl.NumberFormat("tr-TR");

function Cubuk({ oran }: { oran: number }) {
  return (
    <div
      aria-hidden="true"
      className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${oran}%` }} />
    </div>
  );
}

function KirilimKarti({
  baslik,
  bosMetin,
  satirlar,
}: {
  baslik: string;
  bosMetin: string;
  satirlar: KirilimPayi[];
}) {
  const azami = satirlar[0]?.adet ?? 0;

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <h2 className="text-title-3">{baslik}</h2>
      {satirlar.length === 0 ? (
        <p className="mt-3 text-footnote text-muted-foreground">{bosMetin}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {satirlar.slice(0, 8).map((s) => (
            <li key={s.etiket}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-callout text-foreground">
                  {s.etiket}
                </span>
                <span className="tabular shrink-0 text-callout font-semibold text-foreground">
                  {tr.format(s.adet)}
                </span>
              </div>
              <Cubuk oran={payYuzdesi(s.adet, azami)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PanoIstatistik({
  ozet,
  gelismisOzet,
  bekleyen,
  aralikEtiketi,
  gelismisGun,
  calisanMi,
}: {
  ozet: AralikOzeti;
  gelismisOzet: GelismisOzet;
  /** Bekleyen sipariş sayısı; yönetici değilse ya da entegrasyon yoksa null. */
  bekleyen: number | null;
  /** "Bugün", "01.09.2026 - 16.09.2026" gibi tek satır aralık metni. */
  aralikEtiketi: string;
  gelismisGun: number;
  calisanMi: boolean;
}) {
  const buyume = gelismisOzet.haftalikBuyumePct;
  const azamiCalisan = ozet.calisanBazinda[0]?.adet ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKarti
          etiket="Okutulan paket"
          deger={tr.format(ozet.toplam)}
          dipnot={aralikEtiketi}
          ikon={Package}
        />

        {bekleyen !== null && (
          <StatKarti
            etiket="Bekleyen sipariş"
            deger={tr.format(bekleyen)}
            dipnot="Takip numarası gelmiş, henüz hazırlanmamış"
            ikon={Inbox}
          />
        )}

        <StatKarti
          etiket="Günlük ortalama"
          deger={gelismisOzet.gunlukOrtalama.toLocaleString("tr-TR")}
          dipnot={`Son ${gelismisGun} gün`}
          ikon={Clock}
        />

        <StatKarti
          etiket="Haftalık değişim"
          deger={
            <span
              className={
                buyume > 0 ? "text-success" : buyume < 0 ? "text-destructive" : undefined
              }
            >
              {buyume > 0 ? "+" : ""}
              {buyume.toLocaleString("tr-TR")}%
            </span>
          }
          dipnot={`Son 7 gün ${tr.format(gelismisOzet.sonHafta)}, önceki 7 gün ${tr.format(
            gelismisOzet.oncekiHafta,
          )}`}
          ikon={buyume < 0 ? TrendingDown : TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-title-3">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {calisanMi ? "Sizin okutmalarınız" : "Çalışan bazında"}
          </h2>
          {ozet.calisanBazinda.length === 0 ? (
            <p className="mt-3 text-footnote text-muted-foreground">
              Bu aralıkta okutma yok.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {ozet.calisanBazinda.slice(0, 8).map((c) => (
                <li key={c.kullaniciId} className="flex items-center gap-2.5">
                  <Avatar ad={c.ad} profilGorsel={c.profilGorsel} boyut="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-callout text-foreground">
                        {c.ad}
                      </span>
                      <span className="tabular shrink-0 text-callout font-semibold text-foreground">
                        {tr.format(c.adet)}
                      </span>
                    </div>
                    <Cubuk oran={payYuzdesi(c.adet, azamiCalisan)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <KirilimKarti
          baslik="Kaynak bazında"
          bosMetin="Bu aralıkta okutma yok."
          satirlar={ozet.kaynakBazinda}
        />

        <KirilimKarti
          baslik="Kargo firması bazında"
          bosMetin="Bu aralıkta okutma yok."
          satirlar={ozet.kargoBazinda}
        />
      </div>
    </div>
  );
}
