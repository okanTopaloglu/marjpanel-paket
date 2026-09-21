"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { sirketKaydet } from "@/server/actions/kayit";
import { telefonMaske } from "@/lib/format/telefon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * KAYIT FORMU.
 *
 * HATA ALAN BAZLIDIR: sunucu `alanlar` sözlüğü döndürür ve her mesaj kendi
 * alanının altında görünür ("bu telefon zaten kayıtlı" telefonun altında,
 * "şirket adı kullanılıyor" şirket adının altında). Tek bir genel kutu
 * kullanıcıyı yanlış alana baktırırdı.
 */
export function KayitForm() {
  const [durum, formAction, pending] = useActionState(sirketKaydet, undefined);
  const [telefon, setTelefon] = useState("");

  const alan = (ad: string) => durum?.alanlar?.[ad];
  const genelHata = durum && !durum.ok && !durum.alanlar ? durum.mesaj : null;
  const basari = durum?.ok ? durum.mesaj : null;

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

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="sirketAd">Şirket adı</Label>
        <Input
          id="sirketAd"
          name="sirketAd"
          type="text"
          autoComplete="organization"
          placeholder="Örnek Lojistik"
          required
          autoFocus
          aria-invalid={alan("sirketAd") ? true : undefined}
          aria-describedby={alan("sirketAd") ? "hata-sirketAd" : undefined}
        />
        {alan("sirketAd") && <HataSatiri id="hata-sirketAd" mesaj={alan("sirketAd")!} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ad">Adınız soyadınız</Label>
        <Input
          id="ad"
          name="ad"
          type="text"
          autoComplete="name"
          required
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
        <p className="text-caption text-muted-foreground">Girişte bu numarayı kullanacaksınız.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eposta">E-posta</Label>
        <Input
          id="eposta"
          name="eposta"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ornek@firma.com"
          required
          aria-invalid={alan("eposta") ? true : undefined}
          aria-describedby={alan("eposta") ? "hata-eposta" : undefined}
        />
        {alan("eposta") && <HataSatiri id="hata-eposta" mesaj={alan("eposta")!} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="parola">Parola</Label>
        <Input
          id="parola"
          name="parola"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          aria-invalid={alan("parola") ? true : undefined}
          aria-describedby={alan("parola") ? "hata-parola" : "kayit-parola-ipucu"}
        />
        {alan("parola") ? (
          <HataSatiri id="hata-parola" mesaj={alan("parola")!} />
        ) : (
          <p id="kayit-parola-ipucu" className="text-caption text-muted-foreground">
            En az 6 karakter.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="parolaTekrar">Parola tekrar</Label>
        <Input
          id="parolaTekrar"
          name="parolaTekrar"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={alan("parolaTekrar") ? true : undefined}
          aria-describedby={alan("parolaTekrar") ? "hata-parolaTekrar" : undefined}
        />
        {alan("parolaTekrar") && (
          <HataSatiri id="hata-parolaTekrar" mesaj={alan("parolaTekrar")!} />
        )}
      </div>

      {genelHata && <HataSatiri id="kayit-hata" mesaj={genelHata} />}

      {basari && (
        <p
          id="kayit-basari"
          role="status"
          className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-success"
        >
          <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{basari}</span>
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Hesap oluşturuluyor" : "Kaydı tamamla"}
      </Button>
    </form>
  );
}
