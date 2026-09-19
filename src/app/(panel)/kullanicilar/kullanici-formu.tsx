"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { kullaniciEkle, kullaniciGuncelle } from "@/server/actions/kullanicilar";
import { telefonGorunum, telefonMaske } from "@/lib/format/telefon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormGonderButonu } from "@/components/panel/form-buton";
import { FormKabugu } from "@/components/panel/form-kabugu";
import type { KullaniciListeSatiri } from "@/lib/db/repos/kullanicilar";

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

interface SirketSecenegi {
  id: string;
  ad: string;
}

function KullaniciFormIcerigi({
  kullanici,
  superMi,
  kendiHesabiMi,
  sirketSecenekleri,
  onBasarili,
}: {
  kullanici?: KullaniciListeSatiri;
  superMi: boolean;
  kendiHesabiMi: boolean;
  sirketSecenekleri: SirketSecenegi[];
  onBasarili: () => void;
}) {
  const duzenlemeModu = kullanici !== undefined;
  const eylem = duzenlemeModu ? kullaniciGuncelle : kullaniciEkle;
  const [durum, formAction] = useActionState(eylem, undefined);
  const [telefon, setTelefon] = useState(
    kullanici ? telefonGorunum(kullanici.telefon) : "",
  );

  useEffect(() => {
    if (durum?.ok) onBasarili();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  const alan = (ad: string) => durum?.alanlar?.[ad];
  const genelHata = durum && !durum.ok && !durum.alanlar ? durum.mesaj : null;

  // Kendi rolünü değiştiremez (repo da bunu zorunlu kılar); alan burada
  // salt okunur gösterilir ki kullanıcı önce deneyip sonra hata görmesin.
  const rolDegistirilebilir = !kendiHesabiMi;

  return (
    <form action={formAction} className="space-y-4">
      {duzenlemeModu && <input type="hidden" name="id" value={kullanici.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="ad">Ad soyad</Label>
        <Input
          id="ad"
          name="ad"
          type="text"
          autoComplete="name"
          defaultValue={kullanici?.ad}
          required
          autoFocus
          aria-invalid={alan("ad") ? true : undefined}
          aria-describedby={alan("ad") ? "hata-ad" : undefined}
        />
        {alan("ad") && <HataSatiri id="hata-ad" mesaj={alan("ad")!} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="telefon">Telefon</Label>
        <Input
          id="telefon"
          name="telefon"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0532 123 45 67"
          value={telefon}
          onChange={(e) => setTelefon(telefonMaske(e.target.value))}
          required
          aria-invalid={alan("telefon") ? true : undefined}
          aria-describedby={alan("telefon") ? "hata-telefon" : undefined}
        />
        {alan("telefon") && <HataSatiri id="hata-telefon" mesaj={alan("telefon")!} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="parola">{duzenlemeModu ? "Yeni parola" : "Parola"}</Label>
        <Input
          id="parola"
          name="parola"
          type="password"
          autoComplete="new-password"
          minLength={duzenlemeModu ? undefined : 6}
          required={!duzenlemeModu}
          aria-invalid={alan("parola") ? true : undefined}
          aria-describedby={alan("parola") ? "hata-parola" : "parola-ipucu"}
        />
        {alan("parola") ? (
          <HataSatiri id="hata-parola" mesaj={alan("parola")!} />
        ) : (
          <p id="parola-ipucu" className="text-caption text-muted-foreground">
            {duzenlemeModu ? "Boş bırakılırsa parola değişmez." : "En az 6 karakter."}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rol">Rol</Label>
          <Select
            id="rol"
            name="rol"
            defaultValue={kullanici?.rol ?? "calisan"}
            disabled={!rolDegistirilebilir}
            aria-invalid={alan("rol") ? true : undefined}
          >
            <option value="calisan">Çalışan</option>
            <option value="admin">Yönetici</option>
            {superMi && <option value="super_admin">Platform yöneticisi</option>}
          </Select>
          {kendiHesabiMi && (
            <p className="text-caption text-muted-foreground">Kendi rolünüzü değiştiremezsiniz.</p>
          )}
          {alan("rol") && <HataSatiri id="hata-rol" mesaj={alan("rol")!} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="okutmaModu">Okutma modu</Label>
          <Select
            id="okutmaModu"
            name="okutmaModu"
            defaultValue={kullanici?.okutmaModu ?? ""}
          >
            <option value="">Şirket varsayılanı</option>
            <option value="hizli">Hızlı</option>
            <option value="rehberli">Rehberli</option>
            <option value="toplama">Toplama</option>
          </Select>
        </div>
      </div>

      {superMi && !duzenlemeModu && sirketSecenekleri.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="sirketId">Şirket</Label>
          <Select id="sirketId" name="sirketId" defaultValue="">
            <option value="">Kendi şirketim</option>
            {sirketSecenekleri.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad}
              </option>
            ))}
          </Select>
        </div>
      )}

      {genelHata && <HataSatiri id="kullanici-form-hata" mesaj={genelHata} />}

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

export function KullaniciFormu({
  acik,
  onKapat,
  kullanici,
  superMi,
  kendiId,
  sirketSecenekleri,
}: {
  acik: boolean;
  onKapat: () => void;
  /** Verilirse düzenleme modu; verilmezse ekleme modu. */
  kullanici?: KullaniciListeSatiri;
  superMi: boolean;
  kendiId: string;
  sirketSecenekleri: SirketSecenegi[];
}) {
  return (
    <FormKabugu
      acik={acik}
      onKapat={onKapat}
      baslik={kullanici ? "Kullanıcıyı düzenle" : "Kullanıcı ekle"}
    >
      {acik && (
        <KullaniciFormIcerigi
          key={kullanici?.id ?? "yeni"}
          kullanici={kullanici}
          superMi={superMi}
          kendiHesabiMi={kullanici?.id === kendiId}
          sirketSecenekleri={sirketSecenekleri}
          onBasarili={onKapat}
        />
      )}
    </FormKabugu>
  );
}

/** Sayfa başlığındaki "Kullanıcı ekle" düğmesi — kendi açık/kapalı durumunu taşır. */
export function KullaniciEkleTetikleyici({
  superMi,
  kendiId,
  sirketSecenekleri,
}: {
  superMi: boolean;
  kendiId: string;
  sirketSecenekleri: SirketSecenegi[];
}) {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <Button onClick={() => setAcik(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Kullanıcı ekle
      </Button>
      <KullaniciFormu
        acik={acik}
        onKapat={() => setAcik(false)}
        superMi={superMi}
        kendiId={kendiId}
        sirketSecenekleri={sirketSecenekleri}
      />
    </>
  );
}
