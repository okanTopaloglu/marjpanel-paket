"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { urunKaydet } from "@/server/actions/urunler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import type { UrunSatiri } from "@/lib/db/repos/urunler";

/**
 * Ürün ekleme/düzenleme formu - `FormKabugu` (masaüstünde ortalanmış kart,
 * mobilde alttan sheet) içinde tek `useActionState` formu.
 *
 * BARKOD DÜZENLEMEDE KİLİTLİ: kayıt barkodla eşleşir. Barkodu değiştirmek
 * "bu ürünü yeniden adlandır" değil, "başka bir ürüne yaz" demektir - alan
 * açık bırakılsaydı kullanıcı sessizce ikinci bir kayıt üretirdi. Barkodu
 * yanlış girilen ürün silinip yeniden eklenir.
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

function UrunFormIcerigi({
  urun,
  onBasarili,
}: {
  urun?: UrunSatiri;
  onBasarili: () => void;
}) {
  const duzenlemeModu = urun !== undefined;
  const [durum, formAction] = useActionState(urunKaydet, undefined);

  useEffect(() => {
    if (durum?.ok) onBasarili();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  const alan = (ad: string) => durum?.alanlar?.[ad];
  const genelHata = durum && !durum.ok && !durum.alanlar ? durum.mesaj : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="barkod">Barkod</Label>
        <Input
          id="barkod"
          name="barkod"
          type="text"
          inputMode="text"
          autoComplete="off"
          defaultValue={urun?.barkod}
          readOnly={duzenlemeModu}
          required
          autoFocus={!duzenlemeModu}
          className={duzenlemeModu ? "tabular bg-muted" : "tabular"}
          aria-invalid={alan("barkod") ? true : undefined}
          aria-describedby={alan("barkod") ? "hata-barkod" : "barkod-ipucu"}
        />
        {alan("barkod") ? (
          <HataSatiri id="hata-barkod" mesaj={alan("barkod")!} />
        ) : (
          <p id="barkod-ipucu" className="text-caption text-muted-foreground">
            {duzenlemeModu
              ? "Barkod kaydın anahtarıdır, değiştirilemez."
              : "Aynı barkod zaten varsa kayıt güncellenir."}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="urunAdi">Ürün adı</Label>
        <Input
          id="urunAdi"
          name="urunAdi"
          type="text"
          autoComplete="off"
          defaultValue={urun?.urunAdi ?? ""}
          autoFocus={duzenlemeModu}
          aria-invalid={alan("urunAdi") ? true : undefined}
        />
        {alan("urunAdi") && <HataSatiri id="hata-urunAdi" mesaj={alan("urunAdi")!} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gorselUrl">Görsel bağlantısı</Label>
        <Input
          id="gorselUrl"
          name="gorselUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          defaultValue={urun?.gorselUrl ?? ""}
          aria-invalid={alan("gorselUrl") ? true : undefined}
          aria-describedby={alan("gorselUrl") ? "hata-gorselUrl" : "gorsel-ipucu"}
        />
        {alan("gorselUrl") ? (
          <HataSatiri id="hata-gorselUrl" mesaj={alan("gorselUrl")!} />
        ) : (
          <p id="gorsel-ipucu" className="text-caption text-muted-foreground">
            Okutma ekranında sipariş içeriğinde bu görsel gösterilir.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="marka">Marka</Label>
          <Input
            id="marka"
            name="marka"
            type="text"
            autoComplete="off"
            defaultValue={urun?.marka ?? ""}
            aria-invalid={alan("marka") ? true : undefined}
          />
          {alan("marka") && <HataSatiri id="hata-marka" mesaj={alan("marka")!} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kategori">Kategori</Label>
          <Input
            id="kategori"
            name="kategori"
            type="text"
            autoComplete="off"
            defaultValue={urun?.kategori ?? ""}
            aria-invalid={alan("kategori") ? true : undefined}
          />
          {alan("kategori") && <HataSatiri id="hata-kategori" mesaj={alan("kategori")!} />}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stokKodu">Stok kodu</Label>
        <Input
          id="stokKodu"
          name="stokKodu"
          type="text"
          autoComplete="off"
          defaultValue={urun?.stokKodu ?? ""}
          aria-invalid={alan("stokKodu") ? true : undefined}
          aria-describedby={alan("stokKodu") ? "hata-stokKodu" : "stok-ipucu"}
        />
        {alan("stokKodu") ? (
          <HataSatiri id="hata-stokKodu" mesaj={alan("stokKodu")!} />
        ) : (
          <p id="stok-ipucu" className="text-caption text-muted-foreground">
            Boş bırakılan alan mevcut değeri silmez, olduğu gibi bırakır.
          </p>
        )}
      </div>

      {genelHata && <HataSatiri id="urun-form-hata" mesaj={genelHata} />}

      <div className="flex items-center justify-end gap-2 pt-1">
        <FormGonderButonu
          yukleniyorMetni="Kaydediliyor"
          className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Kaydet
        </FormGonderButonu>
      </div>
    </form>
  );
}

export function UrunFormu({
  acik,
  onKapat,
  urun,
}: {
  acik: boolean;
  onKapat: () => void;
  /** Verilirse düzenleme modu; verilmezse ekleme modu. */
  urun?: UrunSatiri;
}) {
  return (
    <FormKabugu
      acik={acik}
      onKapat={onKapat}
      baslik={urun ? "Ürünü düzenle" : "Ürün ekle"}
    >
      {acik && (
        <UrunFormIcerigi key={urun?.id ?? "yeni"} urun={urun} onBasarili={onKapat} />
      )}
    </FormKabugu>
  );
}

/** Sayfa başlığındaki "Ürün ekle" düğmesi - kendi açık/kapalı durumunu taşır. */
export function UrunEkleTetikleyici() {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <Button onClick={() => setAcik(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Ürün ekle
      </Button>
      <UrunFormu acik={acik} onKapat={() => setAcik(false)} />
    </>
  );
}
