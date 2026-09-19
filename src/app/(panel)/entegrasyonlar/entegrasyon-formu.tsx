"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { entegrasyonKaydet } from "@/server/actions/entegrasyonlar";
import type { EntegrasyonOzeti } from "@/lib/db/repos/entegrasyonlar";
import type { EylemDurumu } from "@/server/actions/auth";

/**
 * Entegrasyon formu — ekleme ve düzenleme AYNI form.
 *
 * ANAHTAR ALANLARI DÜZENLEMEDE BOŞ AÇILIR ve boş bırakılırsa eskisi korunur.
 * Maskeli değeri alana yazmak (`abc****xyz`) kullanıcıya "anahtar burada"
 * dedirtir, kaydettiğinde de maskeyi gerçek anahtar sanıp kaydederdi.
 * Bu yüzden alan boştur ve altındaki not ne olacağını söyler.
 *
 * Platform ŞİMDİLİK SABİT (Trendyol): seçim kutusu tek seçenekle kullanıcıya
 * olmayan bir karar sordurur. Yeni pazaryeri eklendiğinde burası seçime döner.
 */
export function EntegrasyonFormu({
  duzenlenen,
  onKapat,
}: {
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

  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="id" value={duzenlenen?.id ?? ""} />

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
            Boş bırakılırsa listede platform adı görünür.
          </p>
          {hata("ad") && <p className="text-caption text-destructive">{hata("ad")}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ent-satici">Satıcı ID</Label>
          <Input
            id="ent-satici"
            name="saticiId"
            defaultValue={duzenlenen?.saticiId ?? ""}
            inputMode="numeric"
            placeholder="123456"
            autoComplete="off"
            required
            className="tabular"
          />
          <p className="text-caption text-muted-foreground">
            Trendyol satıcı panelindeki mağaza numarası.
          </p>
          {hata("saticiId") && (
            <p className="text-caption text-destructive">{hata("saticiId")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ent-key">API anahtarı</Label>
          <Input
            id="ent-key"
            name="apiKey"
            type="password"
            autoComplete="new-password"
            placeholder={duzenlenen ? "Değiştirmek için yazın" : ""}
            required={!duzenlenen}
          />
          {duzenlenen && (
            <p className="text-caption text-muted-foreground">
              Boş bırakırsanız kayıtlı anahtar korunur.
            </p>
          )}
          {hata("apiKey") && (
            <p className="text-caption text-destructive">{hata("apiKey")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ent-secret">Gizli anahtar</Label>
          <Input
            id="ent-secret"
            name="apiSecret"
            type="password"
            autoComplete="new-password"
            placeholder={duzenlenen ? "Değiştirmek için yazın" : ""}
            required={!duzenlenen}
          />
          {duzenlenen && (
            <p className="text-caption text-muted-foreground">
              Boş bırakırsanız kayıtlı anahtar korunur.
            </p>
          )}
          {hata("apiSecret") && (
            <p className="text-caption text-destructive">{hata("apiSecret")}</p>
          )}
        </div>
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

/** Form kartını açıp kapatan kabuk (liste üstündeki "Entegrasyon ekle"). */
export function EntegrasyonEkleKarti() {
  const [acik, setAcik] = useState(false);

  if (!acik) {
    return (
      <Button type="button" size="lg" onClick={() => setAcik(true)}>
        <Plus aria-hidden="true" />
        Entegrasyon ekle
      </Button>
    );
  }

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title-3">Yeni Trendyol entegrasyonu</h2>
          <p className="text-footnote text-muted-foreground">
            Satıcı paneldeki API bilgileriyle mağazanızı bağlayın.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Formu kapat"
          onClick={() => setAcik(false)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <EntegrasyonFormu onKapat={() => setAcik(false)} />
    </div>
  );
}
