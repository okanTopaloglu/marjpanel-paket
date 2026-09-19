"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Rozet } from "@/components/ui/rozet";
import { Iskelet } from "@/components/panel/iskelet";
import { goreliZaman, tarihSaat } from "@/lib/format/tarih";
import type { IsOzeti, SenkronDurumOzeti } from "@/lib/db/repos/senkron-isleri";

/**
 * SENKRON DURUM KARTI — `/api/senkron/durum` ucunu yoklar.
 *
 * YOKLAMA HIZI DURUMA GÖRE DEĞİŞİR: iş çalışırken 2 saniye (kullanıcı ilerleme
 * çubuğunun aktığını görmeli), boştayken 15 saniye. Sabit 2 saniye, senkron
 * çalışmadığı sürenin tamamında (yani zamanın %99'unda) boşa sorgu demekti;
 * sabit 15 saniye ise ilerleme çubuğunu slayt gösterisine çevirirdi.
 *
 * Sekme arka plandayken yoklama DURUR (`visibilitychange`): açık unutulan bir
 * panel sekmesi gece boyunca dakikada dört sorgu atmasın.
 */
type DurumYaniti = SenkronDurumOzeti & { ok: boolean; bekleyenSiparis: number };

const HIZLI_MS = 2_000;
const YAVAS_MS = 15_000;

function durumRozeti(is: IsOzeti) {
  if (is.durum === "calisiyor") return <Rozet ton="bilgi">Çalışıyor</Rozet>;
  if (is.durum === "tamam") return <Rozet ton="basari">Tamam</Rozet>;
  if (is.durum === "hata") return <Rozet ton="hata">Hata</Rozet>;
  return <Rozet ton="notr">İptal</Rozet>;
}

function IlerlemeCubugu({ oran }: { oran: number | null }) {
  // Toplam sayfa bilinmiyorsa belirsiz bir çubuk çizilir (dolu değil, akan).
  const belirsiz = oran === null;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={belirsiz ? undefined : Math.round(oran * 100)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-gecis ease-out"
        style={{ width: belirsiz ? "35%" : `${Math.min(100, Math.round(oran * 100))}%` }}
      />
    </div>
  );
}

export function SenkronDurumu() {
  const [veri, setVeri] = useState<DurumYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let sokuldu = false;
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    // Yoklama aralığı kapanış içinde okunur; state'e bakmak bayat değer verirdi.
    let calisiyor = false;

    const durdur = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = null;
    };

    const planla = () => {
      durdur();
      if (sokuldu || document.visibilityState === "hidden") return;
      zamanlayici = setTimeout(yokla, calisiyor ? HIZLI_MS : YAVAS_MS);
    };

    async function yokla(): Promise<void> {
      try {
        const yanit = await fetch("/api/senkron/durum", { cache: "no-store" });
        if (yanit.ok) {
          const cevap = (await yanit.json()) as DurumYaniti;
          if (!sokuldu) {
            calisiyor = !!cevap.calisiyor;
            setVeri(cevap);
          }
        }
      } catch {
        // Ağ koptuysa kart son bilinen değeri gösterir; sonraki turda düzelir.
      } finally {
        if (!sokuldu) {
          setYukleniyor(false);
          planla();
        }
      }
    }

    const gorunurluk = () => {
      if (document.visibilityState === "visible") void yokla();
      else durdur();
    };

    void yokla();
    document.addEventListener("visibilitychange", gorunurluk);
    return () => {
      sokuldu = true;
      durdur();
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, []);

  if (yukleniyor && !veri) {
    return (
      <div className="rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="space-y-3">
          <Iskelet className="h-4 w-40" />
          <Iskelet className="h-1.5 w-full" />
          <Iskelet className="h-3 w-56" />
        </div>
      </div>
    );
  }

  const calisan = veri?.calisiyor ?? null;
  const ilerleme = calisan?.ilerleme ?? null;
  const oran =
    ilerleme?.toplamSayfa && ilerleme.toplamSayfa > 0 && ilerleme.sayfa != null
      ? Math.min(1, (ilerleme.sayfa + 1) / ilerleme.toplamSayfa)
      : null;

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-title-3">
          <Activity className="h-4 w-4 text-[hsl(var(--vurgu-parlak))]" aria-hidden="true" />
          Senkron durumu
        </h2>
        {calisan ? (
          <Rozet ton="bilgi">Çalışıyor</Rozet>
        ) : (
          <Rozet ton="notr">Boşta</Rozet>
        )}
      </div>

      {calisan ? (
        <div className="mt-4 space-y-2">
          <IlerlemeCubugu oran={oran} />
          <p className="text-footnote text-muted-foreground">
            {ilerleme?.adim === "urun" ? "Ürün kataloğu" : "Siparişler"}
            {ilerleme?.entegrasyon ? ` - ${ilerleme.entegrasyon}` : ""}
            {ilerleme?.sayfa != null
              ? ` - sayfa ${ilerleme.sayfa + 1}${ilerleme.toplamSayfa ? `/${ilerleme.toplamSayfa}` : ""}`
              : ""}
            {ilerleme?.yazilan != null ? ` - ${ilerleme.yazilan} kayıt yazıldı` : ""}
          </p>
          {ilerleme?.tamamlanan && Object.keys(ilerleme.tamamlanan).length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
              {Object.entries(ilerleme.tamamlanan).map(([ad, adet]) => (
                <li key={ad} className="tabular">
                  {ad}: {adet < 0 ? "hata" : adet}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-3 text-footnote text-muted-foreground">
          {veri?.sonIs
            ? `Son iş ${goreliZaman(veri.sonIs.bitis ?? veri.sonIs.baslangic)}: ${veri.sonIs.mesaj ?? "-"}`
            : "Henüz senkron çalışmadı."}
          {veri ? ` Bekleyen sipariş: ${veri.bekleyenSiparis}.` : ""}
        </p>
      )}

      {veri && veri.gecmis.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-overline text-muted-foreground">Son işler</p>
          <ul className="mt-2 space-y-1.5">
            {veri.gecmis.map((is) => (
              <li key={is.id} className="flex flex-wrap items-center gap-2 text-caption">
                {durumRozeti(is)}
                <span className="tabular text-muted-foreground">
                  {tarihSaat(is.bitis ?? is.baslangic)}
                </span>
                <span className="min-w-0 flex-1 truncate">{is.mesaj ?? "-"}</span>
                {is.hatalar?.length ? (
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0 text-destructive"
                    aria-label={`${is.hatalar.length} hata`}
                  />
                ) : is.durum === "tamam" ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-success"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
