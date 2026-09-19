"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { sirketKaydetForm } from "@/server/actions/sirketler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import type { SirketSayimli } from "@/lib/db/repos/sirketler";

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

function SirketFormIcerigi({
  sirket,
  onBasarili,
}: {
  sirket?: SirketSayimli;
  onBasarili: () => void;
}) {
  const [durum, formAction] = useActionState(sirketKaydetForm, undefined);

  useEffect(() => {
    if (durum?.ok) onBasarili();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  const alan = (ad: string) => durum?.alanlar?.[ad];
  const genelHata = durum && !durum.ok && !durum.alanlar ? durum.mesaj : null;

  return (
    <form action={formAction} className="space-y-4">
      {sirket && <input type="hidden" name="id" value={sirket.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="ad">Şirket adı</Label>
        <Input
          id="ad"
          name="ad"
          type="text"
          autoComplete="organization"
          defaultValue={sirket?.ad}
          required
          autoFocus
          aria-invalid={alan("ad") ? true : undefined}
          aria-describedby={alan("ad") ? "hata-ad" : undefined}
        />
        {alan("ad") && <HataSatiri id="hata-ad" mesaj={alan("ad")!} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alanAdi">Alan adı</Label>
        <Input
          id="alanAdi"
          name="alanAdi"
          type="text"
          placeholder="ornek.com"
          defaultValue={sirket?.alanAdi ?? ""}
          aria-invalid={alan("alanAdi") ? true : undefined}
          aria-describedby={alan("alanAdi") ? "hata-alanAdi" : "alanAdi-ipucu"}
        />
        {alan("alanAdi") ? (
          <HataSatiri id="hata-alanAdi" mesaj={alan("alanAdi")!} />
        ) : (
          <p id="alanAdi-ipucu" className="text-caption text-muted-foreground">
            İsteğe bağlı.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="azamiEntegrasyon">Azami entegrasyon sayısı</Label>
        <Input
          id="azamiEntegrasyon"
          name="azamiEntegrasyon"
          type="number"
          min={0}
          step={1}
          placeholder="Sınırsız"
          defaultValue={sirket?.azamiEntegrasyon ?? ""}
          aria-invalid={alan("azamiEntegrasyon") ? true : undefined}
          aria-describedby={alan("azamiEntegrasyon") ? "hata-azami" : "azami-ipucu"}
        />
        {alan("azamiEntegrasyon") ? (
          <HataSatiri id="hata-azami" mesaj={alan("azamiEntegrasyon")!} />
        ) : (
          <p id="azami-ipucu" className="text-caption text-muted-foreground">
            Boş bırakılırsa sınırsız entegrasyon kurulabilir.
          </p>
        )}
      </div>

      <fieldset className="space-y-2.5">
        <legend className="text-footnote font-semibold text-foreground">Özellikler</legend>
        {[
          { ad: "faturaPaylasAcik", etiket: "Fatura paylaşımı" },
          { ad: "faturaKesimAcik", etiket: "Fatura kesimi" },
          { ad: "mailAcik", etiket: "Mail bildirimleri" },
        ].map((ozellik) => (
          <label
            key={ozellik.ad}
            className="flex min-h-touch cursor-pointer items-center gap-2.5 text-callout font-medium text-foreground"
          >
            <input
              type="checkbox"
              name={ozellik.ad}
              defaultChecked={
                sirket
                  ? Boolean(sirket[ozellik.ad as "faturaPaylasAcik" | "faturaKesimAcik" | "mailAcik"])
                  : false
              }
              className="h-4 w-4 shrink-0 accent-[hsl(var(--vurgu-parlak))]"
            />
            {ozellik.etiket}
          </label>
        ))}
      </fieldset>

      {genelHata && <HataSatiri id="sirket-form-hata" mesaj={genelHata} />}

      <div className="flex items-center justify-end gap-2 pt-1">
        <FormGonderButonu
          yukleniyorMetni={sirket ? "Kaydediliyor" : "Oluşturuluyor"}
          className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {sirket ? "Kaydet" : "Oluştur"}
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function SirketFormu({
  acik,
  onKapat,
  sirket,
}: {
  acik: boolean;
  onKapat: () => void;
  sirket?: SirketSayimli;
}) {
  return (
    <FormKabugu acik={acik} onKapat={onKapat} baslik={sirket ? "Şirketi düzenle" : "Şirket ekle"}>
      {acik && (
        <SirketFormIcerigi key={sirket?.id ?? "yeni"} sirket={sirket} onBasarili={onKapat} />
      )}
    </FormKabugu>
  );
}

export function SirketEkleTetikleyici() {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <Button onClick={() => setAcik(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Şirket ekle
      </Button>
      <SirketFormu acik={acik} onKapat={() => setAcik(false)} />
    </>
  );
}
