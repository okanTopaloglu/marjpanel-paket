"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { MobilSheet } from "@/components/ui/mobil-sheet";
import { Rozet, PazaryeriRozeti } from "@/components/ui/rozet";
import { Iskelet } from "@/components/panel/iskelet";
import { Kopyalanabilir } from "@/components/ui/kopyala";
import { tarihSaat } from "@/lib/format/tarih";
import { GORUNEN_DURUM_ETIKETI } from "@/lib/siparis/durum";
import { siparisDetayi } from "@/server/actions/siparisler";
import type { SiparisDetayi } from "@/lib/db/repos/siparisler";

/**
 * Sipariş detayı — kalemler, görseller ve adres.
 *
 * TEK YÜZEY: masaüstünde de `MobilSheet` kullanılır. Detay burada bir "sayfa"
 * değil bir "bakış"tır; ayrı bir masaüstü diyaloğu sürdürmek iki yüzey
 * demekti ve panelin geri kalanı (onay diyaloğu, filtre paneli) zaten sheet
 * ile aynı hareketi paylaşıyor.
 *
 * Veri açılışta çekilir: 50 satırlık listede her satırın görselini önden
 * yüklemek gereksiz sorgu olurdu.
 */
export function SiparisDetay({
  siparisId,
  onKapat,
}: {
  siparisId: string | null;
  onKapat: () => void;
}) {
  const [veri, setVeri] = useState<SiparisDetayi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (!siparisId) return;
    let sokuldu = false;
    setVeri(null);
    setYukleniyor(true);
    void siparisDetayi(siparisId)
      .then((d) => {
        if (!sokuldu) setVeri(d);
      })
      .finally(() => {
        if (!sokuldu) setYukleniyor(false);
      });
    return () => {
      sokuldu = true;
    };
  }, [siparisId]);

  return (
    <MobilSheet
      acik={!!siparisId}
      onKapat={onKapat}
      baslik={veri?.siparisNo ? `Sipariş ${veri.siparisNo}` : "Sipariş detayı"}
    >
      <div className="space-y-5 px-4 pb-6">
        {yukleniyor && !veri && (
          <div className="space-y-2">
            <Iskelet className="h-4 w-40" />
            <Iskelet className="h-4 w-64 max-w-full" />
            <Iskelet className="h-16 w-full" />
          </div>
        )}

        {!yukleniyor && !veri && (
          <p className="text-footnote text-muted-foreground">
            Sipariş bulunamadı. Liste yenilendiğinde kayıt silinmiş olabilir.
          </p>
        )}

        {veri && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <PazaryeriRozeti platform={veri.platform} />
              <Rozet
                ton={
                  veri.gorunenDurum === "kargoda"
                    ? "basari"
                    : veri.gorunenDurum === "iptal"
                      ? "hata"
                      : veri.gorunenDurum === "hazir"
                        ? "bilgi"
                        : "uyari"
                }
              >
                {GORUNEN_DURUM_ETIKETI[veri.gorunenDurum]}
              </Rozet>
              {veri.entegrasyonAdi && <Rozet>{veri.entegrasyonAdi}</Rozet>}
            </div>

            <dl className="grid gap-x-6 gap-y-2 text-footnote sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Müşteri</dt>
                <dd className="font-semibold">{veri.musteriAd}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sipariş tarihi</dt>
                <dd className="tabular font-semibold">{tarihSaat(veri.siparisTarihi)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kargo firması</dt>
                <dd className="font-semibold">{veri.kargoFirmasi ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Takip no</dt>
                <dd className="tabular font-semibold">
                  {veri.kargoTakipNo ? (
                    <Kopyalanabilir deger={veri.kargoTakipNo}>
                      {veri.kargoTakipNo}
                    </Kopyalanabilir>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              {veri.telefon && (
                <div>
                  <dt className="text-muted-foreground">Telefon</dt>
                  <dd className="tabular font-semibold">{veri.telefon}</dd>
                </div>
              )}
            </dl>

            <div>
              <p className="text-overline text-muted-foreground">Teslimat adresi</p>
              <p className="mt-1 text-footnote">{veri.adresAcik || "-"}</p>
              <p className="text-footnote text-muted-foreground">{veri.adresIlceIl}</p>
            </div>

            <div>
              <p className="text-overline text-muted-foreground">
                Kalemler ({veri.kalemler.length})
              </p>
              <ul className="mt-2 space-y-2">
                {veri.kalemler.map((k, i) => (
                  <li
                    key={`${k.barkod}-${i}`}
                    className="flex items-center gap-3 rounded-[--radius-kontrol] border border-border p-2"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[--radius-kontrol] bg-muted">
                      {k.gorselUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- pazaryeri görseli; next/image optimizasyonu gereksiz.
                        <img
                          src={k.gorselUrl}
                          alt=""
                          loading="lazy"
                          className="h-11 w-11 object-cover"
                        />
                      ) : (
                        <Package
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-footnote font-semibold">
                        {k.urunAdi}
                      </span>
                      <span className="tabular block text-caption text-muted-foreground">
                        {k.barkod || "barkodsuz"}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-headline">{k.adet}</span>
                  </li>
                ))}
                {veri.kalemler.length === 0 && (
                  <li className="text-footnote text-muted-foreground">
                    Bu siparişte kalem bilgisi yok.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </MobilSheet>
  );
}
