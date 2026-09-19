"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PazaryeriRozeti, Rozet } from "@/components/ui/rozet";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { entegrasyonKaydet } from "@/server/actions/entegrasyonlar";
import { PAZARYERI_SIRASI, PAZARYERLERI } from "@/lib/pazaryeri/kayit";
import type { Platform } from "@/lib/pazaryeri/tipler";
import type { EntegrasyonOzeti } from "@/lib/db/repos/entegrasyonlar";
import type { EylemDurumu } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

/**
 * Entegrasyon formu — ekleme ve düzenleme AYNI form, alanlar PLATFORMDAN.
 *
 * Alan listesi `lib/pazaryeri/kayit` tanımından çizilir: Trendyol üç alan,
 * Amazon iki. Doğrulama sunucuda aynı tanımdan üretilir (`kimlikSemasi`);
 * form ve kural ayrı düşemez.
 *
 * GİZLİ ALANLAR DÜZENLEMEDE BOŞ AÇILIR ve boş bırakılırsa eskisi korunur.
 * Maskeli değeri alana yazmak (`abc****xyz`) kullanıcıya "anahtar burada"
 * dedirtir, kaydettiğinde de maskeyi gerçek anahtar sanıp kaydederdi.
 * Metin alanlar (satıcı ID gibi) açık görünür ve dolu gelir.
 *
 * Platform DÜZENLEMEDE DEĞİŞMEZ: siparişler platform anahtarıyla yazıldı.
 */
export function EntegrasyonFormu({
  platform,
  duzenlenen,
  onKapat,
}: {
  /** Yeni kayıtta seçilen pazaryeri; düzenlemede kayıttan gelir. */
  platform: Platform;
  /** Dolu ise düzenleme kipi. */
  duzenlenen?: EntegrasyonOzeti | null;
  onKapat?: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu | undefined, FormData>(
    entegrasyonKaydet,
    undefined,
  );

  useEffect(() => {
    if (durum?.ok) onKapat?.();
  }, [durum?.ok, durum, onKapat]);

  const hata = (alan: string) => durum?.alanlar?.[alan];
  const tanim = PAZARYERLERI[platform];

  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="id" value={duzenlenen?.id ?? ""} />
      <input type="hidden" name="platform" value={platform} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ent-ad">Mağaza adı</Label>
          <Input
            id="ent-ad"
            name="ad"
            defaultValue={duzenlenen?.ad ?? ""}
            placeholder="Örn. Ana mağaza"
            autoComplete="off"
          />
          <p className="text-caption text-muted-foreground">
            Boş bırakılırsa listede {tanim.ad} adı görünür.
          </p>
          {hata("ad") && <p className="text-caption text-destructive">{hata("ad")}</p>}
        </div>

        {tanim.alanlar.map((alan) => {
          const gizli = alan.tip === "gizli";
          const id = `ent-${alan.ad}`;
          return (
            <div key={alan.ad} className="space-y-1.5">
              <Label htmlFor={id}>{alan.etiket}</Label>
              <Input
                id={id}
                name={alan.ad}
                type={gizli ? "password" : "text"}
                inputMode={alan.sayisal ? "numeric" : undefined}
                autoComplete={gizli ? "new-password" : "off"}
                defaultValue={gizli ? "" : (duzenlenen?.kimlikMaskeli[alan.ad] ?? "")}
                placeholder={gizli && duzenlenen ? "Değiştirmek için yazın" : (alan.ornek ?? "")}
                required={alan.zorunlu && !(gizli && duzenlenen)}
                className={alan.sayisal ? "tabular" : undefined}
              />
              {gizli && duzenlenen ? (
                <p className="text-caption text-muted-foreground">
                  Boş bırakırsanız kayıtlı anahtar korunur.
                </p>
              ) : (
                alan.ipucu && <p className="text-caption text-muted-foreground">{alan.ipucu}</p>
              )}
              {hata(alan.ad) && <p className="text-caption text-destructive">{hata(alan.ad)}</p>}
            </div>
          );
        })}
      </div>

      {durum?.mesaj && !durum.ok && (
        <p role="alert" className="text-footnote text-destructive">
          {durum.mesaj}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FormGonderButonu
          className="h-11 rounded-[--radius-kontrol] bg-primary px-6 text-[0.9375rem] font-semibold text-primary-foreground"
          yukleniyorMetni="Kaydediliyor"
        >
          {duzenlenen ? "Değişiklikleri kaydet" : "Entegrasyonu ekle"}
        </FormGonderButonu>
        {onKapat && (
          <Button type="button" variant="outline" size="lg" onClick={onKapat}>
            Vazgeç
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Pazaryeri seçimi — kartlar. Hazır olmayanlar "Yakında" ile görünür ama
 * seçilemez: yol haritası ekranda, yarım bağlantı kayıtta değil.
 */
function PlatformSec({ onSec }: { onSec: (p: Platform) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {PAZARYERI_SIRASI.map((p) => {
        const t = PAZARYERLERI[p];
        return (
          <button
            key={p}
            type="button"
            disabled={!t.hazir}
            onClick={() => onSec(p)}
            className={cn(
              "press flex min-h-touch min-w-0 flex-col items-start gap-1.5 rounded-[--radius-kontrol] border border-border bg-card p-3 text-left",
              "transition-[border-color,background-color] duration-dokunma ease-out",
              t.hazir
                ? "[@media(hover:hover)and(pointer:fine)]:hover:border-[hsl(var(--vurgu-parlak))] [@media(hover:hover)and(pointer:fine)]:hover:bg-accent"
                : "cursor-not-allowed opacity-60",
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <PazaryeriRozeti platform={p} />
              {!t.hazir && <Rozet ton="notr">Yakında</Rozet>}
            </span>
            <span className="w-full break-words text-caption text-muted-foreground">{t.anahtarNereden}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Form kartını açıp kapatan kabuk (liste üstündeki "Entegrasyon ekle"). */
export function EntegrasyonEkleKarti() {
  const [acik, setAcik] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);

  function kapat() {
    setAcik(false);
    setPlatform(null);
  }

  if (!acik) {
    return (
      <div className="flex justify-end">
        <Button type="button" size="lg" onClick={() => setAcik(true)}>
          <Plus aria-hidden="true" />
          Entegrasyon ekle
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title-3">
            {platform ? `Yeni ${PAZARYERLERI[platform].ad} entegrasyonu` : "Pazaryeri seçin"}
          </h2>
          <p className="text-footnote text-muted-foreground">
            {platform
              ? PAZARYERLERI[platform].anahtarNereden
              : "Siparişleri hangi pazaryerinden çekeceğinizi seçin; alanlar ona göre gelir."}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Formu kapat" onClick={kapat}>
          <X aria-hidden="true" />
        </Button>
      </div>
      {platform ? (
        <>
          <EntegrasyonFormu platform={platform} onKapat={kapat} />
          <button
            type="button"
            onClick={() => setPlatform(null)}
            className="mt-3 text-footnote font-medium text-muted-foreground underline-offset-2 [@media(hover:hover)and(pointer:fine)]:hover:underline"
          >
            Başka pazaryeri seç
          </button>
        </>
      ) : (
        <PlatformSec onSec={setPlatform} />
      )}
    </div>
  );
}
