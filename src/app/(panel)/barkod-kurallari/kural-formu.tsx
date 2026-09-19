"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { kuralKaydet } from "@/server/actions/barkod-kurallari";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import { cn } from "@/lib/utils";
import type { KuralSatiri } from "@/lib/db/repos/barkod-kurallari";

/**
 * Barkod kuralı formu.
 *
 * ÖNCELİK ALANI AÇIKLAMALIDIR: "küçük değer önce denenir" kuralı sezgisel
 * değildir ve yanlış anlaşılınca kısa önek (ör. "60") uzun öneği ("627")
 * yutar, bütün Hepsiburada paketleri e-Ticaret sayılır. Alanın altındaki tek
 * cümle bunu söyler.
 */

const HataSatiri = ({ id, mesaj }: { id: string; mesaj: string }) => (
  <p
    id={id}
    role="alert"
    className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive"
  >
    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{mesaj}</span>
  </p>
);

/** Onay kutusu - 44px dokunma hedefi, etiketin tamamı tıklanabilir. */
function OnayKutusu({
  ad,
  etiket,
  aciklama,
  varsayilan,
}: {
  ad: string;
  etiket: string;
  aciklama?: string;
  varsayilan?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-touch cursor-pointer items-start gap-2.5 rounded-[--radius-kontrol] px-1 py-2",
        "transition-colors duration-dokunma ease-out",
        "[@media(hover:hover)and(pointer:fine)]:hover:bg-muted",
      )}
    >
      <input
        type="checkbox"
        name={ad}
        defaultChecked={varsayilan}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-input accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0">
        <span className="block text-footnote font-semibold text-foreground">{etiket}</span>
        {aciklama && (
          <span className="block text-caption text-muted-foreground">{aciklama}</span>
        )}
      </span>
    </label>
  );
}

function KuralFormIcerigi({
  kural,
  superMi,
  onBasarili,
}: {
  kural?: KuralSatiri;
  superMi: boolean;
  onBasarili: () => void;
}) {
  const duzenlemeModu = kural !== undefined;
  const [durum, formAction] = useActionState(kuralKaydet, undefined);

  useEffect(() => {
    if (durum?.ok) onBasarili();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  const alan = (ad: string) => durum?.alanlar?.[ad];
  const genelHata = durum && !durum.ok && !durum.alanlar ? durum.mesaj : null;

  return (
    <form action={formAction} className="space-y-4">
      {duzenlemeModu && <input type="hidden" name="id" value={kural.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="barkodOneki">Barkod öneki</Label>
        <Input
          id="barkodOneki"
          name="barkodOneki"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          defaultValue={kural?.barkodOneki}
          required
          autoFocus
          className="font-mono uppercase tracking-[0.04em]"
          aria-invalid={alan("barkodOneki") ? true : undefined}
          aria-describedby={alan("barkodOneki") ? "hata-onek" : "onek-ipucu"}
        />
        {alan("barkodOneki") ? (
          <HataSatiri id="hata-onek" mesaj={alan("barkodOneki")!} />
        ) : (
          <p id="onek-ipucu" className="text-caption text-muted-foreground">
            Barkodun başındaki karakterler, örneğin 726 ya da PTT. Büyük harfe
            çevrilerek kaydedilir.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kaynak">Kaynak</Label>
          <Input
            id="kaynak"
            name="kaynak"
            type="text"
            autoComplete="off"
            placeholder="Trendyol"
            defaultValue={kural?.kaynak}
            required
            aria-invalid={alan("kaynak") ? true : undefined}
          />
          {alan("kaynak") && <HataSatiri id="hata-kaynak" mesaj={alan("kaynak")!} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kargoFirmasi">Kargo firması</Label>
          <Input
            id="kargoFirmasi"
            name="kargoFirmasi"
            type="text"
            autoComplete="off"
            placeholder="Aras Kargo"
            defaultValue={kural?.kargoFirmasi}
            required
            aria-invalid={alan("kargoFirmasi") ? true : undefined}
          />
          {alan("kargoFirmasi") && (
            <HataSatiri id="hata-kargo" mesaj={alan("kargoFirmasi")!} />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="oncelik">Öncelik</Label>
        <Input
          id="oncelik"
          name="oncelik"
          type="number"
          min={1}
          max={9999}
          step={1}
          defaultValue={kural?.oncelik ?? 100}
          required
          className="max-w-[10rem]"
          aria-invalid={alan("oncelik") ? true : undefined}
          aria-describedby={alan("oncelik") ? "hata-oncelik" : "oncelik-ipucu"}
        />
        {alan("oncelik") ? (
          <HataSatiri id="hata-oncelik" mesaj={alan("oncelik")!} />
        ) : (
          <p id="oncelik-ipucu" className="text-caption text-muted-foreground">
            Küçük değer önce denenir. Eşit öncelikte uzun önek kazanır, bu yüzden
            kısa öneklere büyük sayı verin.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aciklama">Açıklama</Label>
        <Input
          id="aciklama"
          name="aciklama"
          type="text"
          autoComplete="off"
          placeholder="İsteğe bağlı not"
          defaultValue={kural?.aciklama ?? ""}
          aria-invalid={alan("aciklama") ? true : undefined}
        />
        {alan("aciklama") && <HataSatiri id="hata-aciklama" mesaj={alan("aciklama")!} />}
      </div>

      <div className="space-y-1">
        <OnayKutusu
          ad="aktif"
          etiket="Kural aktif"
          aciklama="Pasif kural okutmada hiç denenmez."
          varsayilan={kural?.aktif ?? true}
        />
        {superMi && (
          <OnayKutusu
            ad="global"
            etiket="Genel kural (tüm şirketler)"
            aciklama="İşaretlenmezse kural yalnız kendi şirketinizde geçerlidir."
            varsayilan={kural ? kural.kapsam === "global" : false}
          />
        )}
      </div>

      {genelHata && <HataSatiri id="kural-form-hata" mesaj={genelHata} />}

      <div className="flex items-center justify-end gap-2 pt-1">
        <FormGonderButonu
          yukleniyorMetni={duzenlemeModu ? "Kaydediliyor" : "Ekleniyor"}
          className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {duzenlemeModu ? "Kaydet" : "Ekle"}
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function KuralFormu({
  acik,
  onKapat,
  kural,
  superMi,
}: {
  acik: boolean;
  onKapat: () => void;
  kural?: KuralSatiri;
  superMi: boolean;
}) {
  return (
    <FormKabugu
      acik={acik}
      onKapat={onKapat}
      baslik={kural ? "Kuralı düzenle" : "Kural ekle"}
    >
      {acik && (
        <KuralFormIcerigi
          key={kural?.id ?? "yeni"}
          kural={kural}
          superMi={superMi}
          onBasarili={onKapat}
        />
      )}
    </FormKabugu>
  );
}

/** Sayfa başlığındaki "Kural ekle" düğmesi. */
export function KuralEkleTetikleyici({ superMi }: { superMi: boolean }) {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <Button onClick={() => setAcik(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Kural ekle
      </Button>
      <KuralFormu acik={acik} onKapat={() => setAcik(false)} superMi={superMi} />
    </>
  );
}
