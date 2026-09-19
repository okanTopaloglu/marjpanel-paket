"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  PackageCheck,
  SkipForward,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { useTarayiciOdak } from "@/lib/hooks/tarayici-odak";
import type { useSes } from "@/lib/hooks/ses";
import type { AtananSiparis } from "@/lib/db/repos/atama";
import { AZAMI_BARKOD_UZUNLUGU } from "@/lib/okut/sonuc";
import { atamaTamamla } from "@/server/actions/atama";
import { RehberliIcerik } from "../rehberli-icerik";
import { cn } from "@/lib/utils";

/**
 * TOPLAMA 3. ADIM - sipariş sipariş paketleme.
 *
 * Ekranda TEK sipariş durur ve okutulan barkod o siparişin kargo takip
 * numarasıyla eşleşmek zorundadır (kontrol sunucuda). Beklenen barkod
 * VARSAYILAN OLARAK GİZLİDİR: ekranda yazıyorsa operatör paketi kontrol
 * etmek yerine ekrandaki numarayı elle yazabilir ve doğrulama bir tiyatroya
 * dönerdi. Takılan bir pakette "Göster" ile bakılabilir.
 *
 * Yanlış paket tam ekran kırmızı perde açar: bu, akışın DURMASI gereken tek
 * andır - yanlış kutu kargoya giderse müşteri yanlış ürün alır.
 */

const PERDE_MS = 3000;
const BILGI_MS = 2500;

type Bilgi = { ton: "basari" | "hata" | "uyari"; metin: string };

export function Paketle({
  siparisler,
  ses,
  onBitti,
  onBirak,
}: {
  siparisler: AtananSiparis[];
  ses: ReturnType<typeof useSes>;
  onBitti: () => void;
  onBirak: () => void;
}) {
  const [kuyruk, setKuyruk] = useState(siparisler);
  const [tamamlanan, setTamamlanan] = useState(0);
  const [barkod, setBarkod] = useState("");
  const [uyusmazlik, setUyusmazlik] = useState<{
    beklenen: string;
    okutulan: string;
  } | null>(null);
  const [bilgi, setBilgi] = useState<Bilgi | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [beklenenGorunsun, setBeklenenGorunsun] = useState(false);
  const [onayAcik, setOnayAcik] = useState(false);

  const girisRef = useRef<HTMLInputElement | null>(null);
  const toplam = siparisler.length;
  const mevcut = kuyruk[0] ?? null;

  useTarayiciOdak(girisRef, { etkin: !onayAcik });

  useEffect(() => {
    if (!uyusmazlik) return;
    const z = setTimeout(() => setUyusmazlik(null), PERDE_MS);
    return () => clearTimeout(z);
  }, [uyusmazlik]);

  useEffect(() => {
    if (!bilgi) return;
    const z = setTimeout(() => setBilgi(null), BILGI_MS);
    return () => clearTimeout(z);
  }, [bilgi]);

  // Sipariş değişince beklenen barkod yeniden gizlenir.
  useEffect(() => setBeklenenGorunsun(false), [mevcut?.id]);

  const sonraki = () => setKuyruk((k) => k.slice(1));

  const gonder = async () => {
    const okutulan = barkod.trim();
    if (!mevcut || !okutulan || gonderiliyor) return;
    setBarkod("");
    setGonderiliyor(true);

    try {
      const cevap = await atamaTamamla(mevcut.id, okutulan);
      if (!cevap.ok) {
        ses.cal("hata");
        setBilgi({ ton: "hata", metin: cevap.hata });
        return;
      }

      switch (cevap.sonuc.sonuc) {
        case "tamam":
          ses.cal(cevap.sonuc.uyari ? "uyari" : "basari");
          setBilgi({
            ton: cevap.sonuc.uyari ? "uyari" : "basari",
            metin: cevap.sonuc.uyari
              ? "Paket hazırlandı; bu barkod daha önce okutulmuştu."
              : `Paket hazırlandı${mevcut.siparisNo ? ` (${mevcut.siparisNo})` : ""}.`,
          });
          setTamamlanan((n) => n + 1);
          sonraki();
          break;
        case "barkod_uyusmadi":
          ses.cal("hata");
          setUyusmazlik({
            beklenen: cevap.sonuc.beklenen || (mevcut.kargoTakipNo ?? "-"),
            okutulan,
          });
          break;
        case "iptal":
          ses.cal("hata");
          setBilgi({
            ton: "hata",
            metin: "Sipariş iptal edilmiş. Paketi iptal bölümüne verin; listeden çıkarıldı.",
          });
          sonraki();
          break;
        case "zaten_hazir":
          ses.cal("uyari");
          setBilgi({
            ton: "uyari",
            metin: "Bu paket zaten hazırlanmış, listeden çıkarıldı.",
          });
          sonraki();
          break;
        case "atanmamis":
          ses.cal("uyari");
          setBilgi({
            ton: "uyari",
            metin: "Bu paket artık size atanmamış, listeden çıkarıldı.",
          });
          sonraki();
          break;
        case "bulunamadi":
          ses.cal("hata");
          setBilgi({
            ton: "hata",
            metin: "Sipariş bulunamadı, listeden çıkarıldı.",
          });
          sonraki();
          break;
      }
    } catch {
      ses.cal("hata");
      setBilgi({
        ton: "hata",
        metin: "Paket tamamlanamadı. Bağlantınızı kontrol edip tekrar okutun.",
      });
    } finally {
      setGonderiliyor(false);
      girisRef.current?.focus();
    }
  };

  /* Kuyruk bitti: özet ve yeni gruba dönüş. */
  if (!mevcut) {
    return (
      <div className="rounded-[--radius] border border-border bg-card px-6 py-12 text-center">
        <PackageCheck
          className="mx-auto mb-3 h-12 w-12 text-success"
          aria-hidden="true"
        />
        <p className="text-title-2">Grup tamamlandı</p>
        <p className="mt-1 text-footnote text-muted-foreground">
          {tamamlanan} paket hazırlandı. Yeni bir grup alabilirsiniz.
        </p>
        <Button type="button" size="lg" className="mt-5" onClick={onBitti}>
          Yeni toplama başlat
        </Button>
      </div>
    );
  }

  const ilerleme = Math.round((tamamlanan / Math.max(toplam, 1)) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title-3">Paketleme</h2>
          <span className="tabular text-callout text-muted-foreground">
            {Math.min(tamamlanan + 1, toplam)} / {toplam}
          </span>
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={ilerleme}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Paketleme ilerlemesi"
        >
          <span
            className="block h-full rounded-full bg-primary transition-transform duration-gecis ease-out"
            style={{ width: `${ilerleme}%` }}
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void gonder();
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            ref={girisRef}
            value={barkod}
            onChange={(e) => setBarkod(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && barkod.trim()) {
                e.preventDefault();
                void gonder();
              }
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={AZAMI_BARKOD_UZUNLUGU}
            placeholder="Kargo barkodunu okutun"
            aria-label="Kargo barkodu"
            className={cn(
              "tabular h-14 min-w-0 flex-1 rounded-[--radius-kontrol] border border-input bg-card px-3",
              "text-2xl font-semibold text-foreground placeholder:text-base placeholder:font-medium placeholder:text-muted-foreground",
              "transition-[border-color,box-shadow] duration-gecis ease-out",
              "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
            )}
          />
          <Button type="submit" size="lg" className="h-14 px-6 text-base">
            Okut
          </Button>
        </form>

        {bilgi && (
          <p
            role="status"
            className={cn(
              "mt-3 flex items-center gap-2 rounded-[--radius-kontrol] border px-3 py-2 text-footnote",
              bilgi.ton === "basari" &&
                "border-success/40 bg-success-soft text-success",
              bilgi.ton === "uyari" &&
                "border-warning/40 bg-warning-soft text-warning",
              bilgi.ton === "hata" &&
                "border-destructive/40 bg-destructive-soft text-destructive",
            )}
          >
            {bilgi.ton === "basari" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {bilgi.metin}
          </p>
        )}

        <div data-odak-serbest className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Takılan paket sona atılır; kuyruk boşalmasın diye SİLİNMEZ.
              setKuyruk((k) => (k.length > 1 ? [...k.slice(1), k[0]!] : k));
              setBilgi({
                ton: "uyari",
                metin: "Paket atlandı, listenin sonuna eklendi.",
              });
            }}
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Atla
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setBeklenenGorunsun((g) => !g)}
          >
            {beklenenGorunsun ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {beklenenGorunsun ? "Barkodu gizle" : "Beklenen barkodu göster"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOnayAcik(true)}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Kalanları bırak
          </Button>
        </div>

        {beklenenGorunsun && (
          <p className="tabular mt-2 text-footnote text-muted-foreground">
            Beklenen: {mevcut.kargoTakipNo ?? "-"}
          </p>
        )}
      </div>

      <RehberliIcerik
        kalemler={mevcut.kalemler}
        siparisNo={mevcut.siparisNo}
        baslik={`Sıradaki sipariş${mevcut.kargoFirmasi ? ` - ${mevcut.kargoFirmasi}` : ""}`}
      />

      <OnayDiyalogu
        acik={onayAcik}
        baslik="Kalan paketler bırakılsın mı?"
        aciklama="Hazırlanmamış paketler havuza döner ve başka çalışanlar alabilir."
        onaylaMetni="Bırak"
        tehlikeli
        onOnay={() => {
          setOnayAcik(false);
          onBirak();
        }}
        onKapat={() => setOnayAcik(false)}
      />

      {uyusmazlik && <UyusmazlikPerdesi {...uyusmazlik} onKapat={() => setUyusmazlik(null)} />}
    </div>
  );
}

/** Yanlış paket perdesi - tam ekran kırmızı, dokununca kapanır. */
function UyusmazlikPerdesi({
  beklenen,
  okutulan,
  onKapat,
}: {
  beklenen: string;
  okutulan: string;
  onKapat: () => void;
}) {
  const [gomulu, setGomulu] = useState(false);
  useEffect(() => setGomulu(true), []);
  if (!gomulu) return null;

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      onClick={onKapat}
      className="animate-fade fixed inset-0 z-[95] flex cursor-pointer items-center justify-center bg-destructive p-6 text-center"
    >
      <div className="animate-materialize max-w-lg text-white">
        <XCircle
          className="mx-auto mb-4 h-16 w-16"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <p className="text-display leading-tight">Yanlış paket</p>
        <p className="mt-2 text-body opacity-90">
          Okutulan barkod ekrandaki siparişe ait değil. Doğru kutuyu alın.
        </p>
        <div className="tabular mt-5 space-y-1 text-headline">
          <p className="opacity-90">Beklenen: {beklenen}</p>
          <p className="opacity-90">Okutulan: {okutulan}</p>
        </div>
        <p className="mt-6 text-caption opacity-75">
          Kapatmak için ekrana dokunun
        </p>
      </div>
    </div>,
    document.body,
  );
}
