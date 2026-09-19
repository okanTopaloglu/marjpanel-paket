"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, PackageX } from "lucide-react";
import { Avatar } from "@/components/panel/avatar";
import { tarihSaat } from "@/lib/format/tarih";
import { perdeIcerigi, type OkutmaSonucu } from "@/lib/okut/sonuc";
import { cn } from "@/lib/utils";

/**
 * UYARI PERDESİ - kullanıcının DURMASI gereken anlar.
 *
 * Depoda ekran uzaktadır ve kullanıcı ellerine bakar: küçük bir satır içi
 * uyarı görülmez. Mükerrer paket, iptal edilmiş ya da kargolanmış sipariş
 * tüm ekranı kaplar; başarı ise perde AÇMAZ (akış durmamalı, ses ve satır
 * yeter).
 *
 * Kendiliğinden kapanır (2-3 sn, sonuca göre) ve dokununca da kapanır:
 * kullanıcı okumayı bitirdiyse beklemesin.
 */
export function UyariPerdesi({
  sonuc,
  onKapat,
}: {
  sonuc: OkutmaSonucu | null;
  onKapat: () => void;
}) {
  const icerik = sonuc ? perdeIcerigi(sonuc) : null;
  const [gomulu, setGomulu] = useState(false);

  useEffect(() => setGomulu(true), []);

  useEffect(() => {
    if (!icerik) return;
    const zamanlayici = setTimeout(onKapat, icerik.sureMs);
    return () => clearTimeout(zamanlayici);
  }, [icerik, onKapat]);

  if (!gomulu || !sonuc || !icerik) return null;

  const Ikon =
    sonuc.sonuc === "mukerrer"
      ? PackageX
      : sonuc.sonuc === "kaydedildi"
        ? AlertTriangle
        : Ban;

  // Perde zemini tam tonlu durum rengi (DESIGN.md "Durum"); metin beyaz.
  const zeminler = {
    hata: "bg-destructive",
    uyari: "bg-warning",
    basari: "bg-success",
  } as const;

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      onClick={onKapat}
      className={cn(
        "animate-fade fixed inset-0 z-[95] flex cursor-pointer items-center justify-center p-6 text-center",
        zeminler[icerik.ton],
      )}
    >
      <div className="animate-materialize max-w-lg text-white">
        <Ikon
          className="mx-auto mb-4 h-16 w-16"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <p className="text-display leading-tight">{icerik.baslik}</p>
        <p className="mt-2 text-body opacity-90">{icerik.aciklama}</p>

        <p className="tabular mt-4 text-headline opacity-90">{sonuc.barkod}</p>

        {sonuc.sonuc === "mukerrer" && (
          <div className="mt-4 flex items-center justify-center gap-2 opacity-90">
            <Avatar
              ad={sonuc.mevcut.okutanAd}
              profilGorsel={sonuc.mevcut.profilGorsel}
              boyut="md"
            />
            <span className="text-footnote">
              {sonuc.mevcut.okutanAd} - {tarihSaat(sonuc.mevcut.okutmaZamani)}
            </span>
          </div>
        )}

        {(sonuc.sonuc === "iptal" || sonuc.sonuc === "kargolanmis") &&
          sonuc.siparis.siparisNo && (
            <p className="tabular mt-4 text-footnote opacity-90">
              Sipariş {sonuc.siparis.siparisNo}
              {sonuc.siparis.entegrasyonAdi
                ? ` - ${sonuc.siparis.entegrasyonAdi}`
                : ""}
            </p>
          )}

        <p className="mt-6 text-caption opacity-75">
          Kapatmak için ekrana dokunun
        </p>
      </div>
    </div>,
    document.body,
  );
}
