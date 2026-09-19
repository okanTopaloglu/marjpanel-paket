"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { profilGuncelle } from "@/server/actions/profil";
import { telefonGorunum } from "@/lib/format/telefon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormGonderButonu } from "@/components/panel/form-buton";

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

/**
 * Kendi profil formu — ad + isteğe bağlı parola değişikliği TEK formda.
 * Parola alanları boş bırakılırsa yalnız ad güncellenir (bkz.
 * `server/actions/profil.ts`); parola değiştirmek isteyen önce mevcut
 * parolasını doğrulamak zorundadır.
 */
export function ProfilFormu({ ad, telefon }: { ad: string; telefon: string }) {
  const [durum, formAction] = useActionState(profilGuncelle, undefined);
  const alan = (a: string) => durum?.alanlar?.[a];
  const genelHata = durum && !durum.ok && !durum.alanlar ? durum.mesaj : null;
  const basari = durum?.ok ? durum.mesaj : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hesap bilgileri</CardTitle>
        <CardDescription>Adınızı değiştirin ya da parolanızı güncelleyin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5" key={durum?.ok ? "sifirlandi" : "form"}>
          <div className="space-y-1.5">
            <Label htmlFor="telefon-goruntu">Telefon</Label>
            <Input id="telefon-goruntu" type="tel" value={telefonGorunum(telefon)} disabled readOnly />
            <p className="text-caption text-muted-foreground">
              Telefon numaranızı değiştirmek için yöneticinizle görüşün.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad">Ad soyad</Label>
            <Input
              id="ad"
              name="ad"
              type="text"
              autoComplete="name"
              defaultValue={ad}
              required
              aria-invalid={alan("ad") ? true : undefined}
              aria-describedby={alan("ad") ? "hata-ad" : undefined}
            />
            {alan("ad") && <HataSatiri id="hata-ad" mesaj={alan("ad")!} />}
          </div>

          <fieldset className="space-y-4 border-t border-border pt-4">
            <legend className="text-footnote font-semibold text-foreground">
              Parola değiştir
            </legend>

            <div className="space-y-1.5">
              <Label htmlFor="mevcutParola">Mevcut parola</Label>
              <Input
                id="mevcutParola"
                name="mevcutParola"
                type="password"
                autoComplete="current-password"
                aria-invalid={alan("mevcutParola") ? true : undefined}
                aria-describedby={alan("mevcutParola") ? "hata-mevcutParola" : undefined}
              />
              {alan("mevcutParola") && (
                <HataSatiri id="hata-mevcutParola" mesaj={alan("mevcutParola")!} />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="yeniParola">Yeni parola</Label>
                <Input
                  id="yeniParola"
                  name="yeniParola"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={alan("yeniParola") ? true : undefined}
                  aria-describedby={alan("yeniParola") ? "hata-yeniParola" : undefined}
                />
                {alan("yeniParola") && (
                  <HataSatiri id="hata-yeniParola" mesaj={alan("yeniParola")!} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yeniParolaTekrar">Yeni parola (tekrar)</Label>
                <Input
                  id="yeniParolaTekrar"
                  name="yeniParolaTekrar"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={alan("yeniParolaTekrar") ? true : undefined}
                  aria-describedby={alan("yeniParolaTekrar") ? "hata-yeniParolaTekrar" : undefined}
                />
                {alan("yeniParolaTekrar") && (
                  <HataSatiri id="hata-yeniParolaTekrar" mesaj={alan("yeniParolaTekrar")!} />
                )}
              </div>
            </div>
            <p className="text-caption text-muted-foreground">
              Parolanızı değiştirmek istemiyorsanız bu alanları boş bırakın.
            </p>
          </fieldset>

          {genelHata && <HataSatiri id="profil-form-hata" mesaj={genelHata} />}
          {basari && (
            <p
              role="status"
              className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-success"
            >
              <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{basari}</span>
            </p>
          )}

          <FormGonderButonu
            yukleniyorMetni="Kaydediliyor"
            className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Kaydet
          </FormGonderButonu>
        </form>
      </CardContent>
    </Card>
  );
}
