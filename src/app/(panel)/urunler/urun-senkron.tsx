"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { urunSenkronBaslat } from "@/server/actions/urunler";
import { goreliZaman } from "@/lib/format/tarih";
import { Button } from "@/components/ui/button";
import { Rozet } from "@/components/ui/rozet";
import { Select } from "@/components/ui/select";
import type { EntegrasyonOzeti } from "@/lib/db/repos/entegrasyonlar";
import type { SenkronDurumOzeti } from "@/lib/db/repos/senkron-isleri";
import { PAZARYERLERI, pazaryeriAdi } from "@/lib/pazaryeri/kayit";

/**
 * ÜRÜN SENKRONU KARTI - "<Pazaryeri>'ndan ürünleri çek".
 *
 * İLK DURUM SUNUCUDAN GELİR (`baslangicOzeti`): kart açılır açılmaz doğru
 * bilgiyi gösterir, ilk yoklamayı beklemez. Yoklama yalnız BİR ÜRÜN İŞİ
 * SÜRERKEN çalışır ve iş bittiğinde durur - boştayken saniyede bir uç
 * yoklamak, kullanıcı bu sayfada dakikalarca durduğu için bedava değildir.
 *
 * `/api/senkron/durum` ucu başka bir iş paketinin sorumluluğunda. Uç yoksa
 * (404) ya da ağ koparsa kart YOKLAMAYI BIRAKIR ve sunucudan gelen son
 * bilinen durumu gösterir - hata metniyle ekranı doldurmaz.
 */

const YOKLAMA_MS = 3_000;

/** Yoklama en fazla bu kadar sürer; iş asılı kalırsa sayfa sonsuza dek sormasın. */
const AZAMI_IZLEME_MS = 10 * 60 * 1000;

type DurumYaniti = SenkronDurumOzeti & { ok?: boolean };

function urunIsiCalisiyorMu(ozet: SenkronDurumOzeti | null): boolean {
  return ozet?.calisiyor?.tur === "urun";
}

export function UrunSenkron({
  entegrasyonlar,
  baslangicOzeti,
}: {
  entegrasyonlar: EntegrasyonOzeti[];
  baslangicOzeti: SenkronDurumOzeti;
}) {
  const router = useRouter();
  // Ürün kataloğu vermeyen pazaryeri (Amazon v1) listede görünmez.
  const aktifler = entegrasyonlar.filter((e) => e.aktif && PAZARYERLERI[e.platform].yetenekler.urun);
  const [secili, setSecili] = useState(aktifler[0]?.id ?? "");
  const [ozet, setOzet] = useState<SenkronDurumOzeti>(baslangicOzeti);
  const [izle, setIzle] = useState(() => urunIsiCalisiyorMu(baslangicOzeti));
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // İş "çalışıyor" görüldükten sonra kaybolduğunda izleme biter ve liste
  // tazelenir; bunu state ile takip etmek yoklama kapanışında bayat değer
  // okurdu.
  const calisiyorGorulduRef = useRef(urunIsiCalisiyorMu(baslangicOzeti));

  const baslat = useCallback(() => {
    setMesaj(null);
    startTransition(async () => {
      const cevap = await urunSenkronBaslat(secili);
      setMesaj({ ok: cevap.ok, metin: cevap.mesaj ?? "" });
      if (cevap.ok) setIzle(true);
    });
  }, [secili]);

  useEffect(() => {
    if (!izle) return;
    let sokuldu = false;
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    const bitisAni = Date.now() + AZAMI_IZLEME_MS;

    const durdur = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = null;
    };

    const bitir = () => {
      durdur();
      if (!sokuldu) setIzle(false);
      // Ürün tablosu senkronla değişmiş olabilir; sunucu bileşenini tazele.
      router.refresh();
    };

    async function yokla(): Promise<void> {
      try {
        const yanit = await fetch("/api/senkron/durum", { cache: "no-store" });
        if (!yanit.ok) {
          // 401/404: uç yok ya da oturum düştü. Sessizce bırak.
          bitir();
          return;
        }
        const cevap = (await yanit.json()) as DurumYaniti;
        if (sokuldu) return;
        setOzet(cevap);

        if (urunIsiCalisiyorMu(cevap)) {
          calisiyorGorulduRef.current = true;
        } else if (calisiyorGorulduRef.current) {
          calisiyorGorulduRef.current = false;
          bitir();
          return;
        }
      } catch {
        // Ağ koptu - son bilinen durum ekranda kalsın.
        bitir();
        return;
      }

      if (sokuldu) return;
      if (Date.now() > bitisAni) {
        bitir();
        return;
      }
      zamanlayici = setTimeout(yokla, YOKLAMA_MS);
    }

    void yokla();
    return () => {
      sokuldu = true;
      durdur();
    };
  }, [izle, router]);

  const calisan = ozet.calisiyor;
  const urunCalisiyor = urunIsiCalisiyorMu(ozet);
  const ilerleme = urunCalisiyor ? calisan?.ilerleme : null;
  const sonUrunIsi = ozet.gecmis.find((i) => i.tur === "urun") ?? null;
  const seciliKayit = aktifler.find((e) => e.id === secili) ?? null;

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-title-3">
          <RefreshCw
            className="h-4 w-4 text-[hsl(var(--vurgu-parlak))]"
            aria-hidden="true"
          />
          Pazaryerinden ürün çek
        </h2>
        {urunCalisiyor || izle ? (
          <Rozet ton="bilgi">Çalışıyor</Rozet>
        ) : (
          <Rozet ton="notr">Boşta</Rozet>
        )}
      </div>

      {aktifler.length === 0 ? (
        <p className="mt-3 text-footnote text-muted-foreground">
          Aktif pazaryeri bağlantınız yok. Entegrasyonlar sayfasından bir mağaza
          ekleyin; ürün kataloğu oradan tazelenir.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 sm:max-w-xs sm:flex-1">
              <label htmlFor="urun-senkron-magaza" className="sr-only">
                Mağaza
              </label>
              <Select
                id="urun-senkron-magaza"
                value={secili}
                onChange={(e) => setSecili(e.target.value)}
              >
                {aktifler.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ad?.trim() || pazaryeriAdi(e.platform)} ({e.saticiId})
                  </option>
                ))}
              </Select>
            </div>
            <Button size="lg" onClick={baslat} disabled={pending || !secili}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              {seciliKayit ? `${pazaryeriAdi(seciliKayit.platform)}’dan ürünleri çek` : "Ürünleri çek"}
            </Button>
          </div>

          {seciliKayit && (
            <p className="mt-2 text-caption text-muted-foreground">
              Son ürün senkronu:{" "}
              {seciliKayit.sonUrunSenkron
                ? goreliZaman(seciliKayit.sonUrunSenkron)
                : "hiç çalışmadı"}
              . Katalog ayrıca 12 saatte bir kendiliğinden tazelenir.
            </p>
          )}
        </>
      )}

      {mesaj && (
        <p
          role={mesaj.ok ? "status" : "alert"}
          className={`animate-fade mt-3 flex items-start gap-1.5 text-footnote font-medium ${
            mesaj.ok ? "text-success" : "text-destructive"
          }`}
        >
          {mesaj.ok ? (
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{mesaj.metin}</span>
        </p>
      )}

      {urunCalisiyor && (
        <p className="tabular mt-3 text-footnote text-muted-foreground">
          {ilerleme?.entegrasyon ? `${ilerleme.entegrasyon} - ` : ""}
          {ilerleme?.sayfa != null ? `sayfa ${ilerleme.sayfa + 1}` : "başlatılıyor"}
          {ilerleme?.yazilan != null ? ` - ${ilerleme.yazilan} kayıt yazıldı` : ""}
        </p>
      )}

      {!urunCalisiyor && sonUrunIsi && (
        <p className="mt-3 text-footnote text-muted-foreground">
          Son ürün işi {goreliZaman(sonUrunIsi.bitis ?? sonUrunIsi.baslangic)}:{" "}
          {sonUrunIsi.mesaj ?? "-"}
        </p>
      )}
    </div>
  );
}
