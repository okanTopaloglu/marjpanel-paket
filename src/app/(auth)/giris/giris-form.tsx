"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { girisYap } from "@/server/actions/auth";
import { telefonMaske } from "@/lib/format/telefon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * GİRİŞ FORMU.
 *
 * TELEFON MASKESİ: kullanıcı depodayken tek eliyle yazar; "0532 123 45 67"
 * biçimi yanlış hane sayısını gözle yakalatır. Sunucu maskeyi zaten
 * `telefonNormalize` ile temizler, maske yalnız okunabilirlik içindir.
 *
 * HATA PAROLA ALANININ ALTINDA: sunucudan dönen mesaj telefon + parola
 * ikilisine aittir (hangisinin yanlış olduğu BİLEREK söylenmez). İki alan da
 * `aria-invalid` alır ve `aria-describedby` ile mesaja bağlanır.
 */
export function GirisForm({ geri }: { geri: string | null }) {
  const [durum, formAction, pending] = useActionState(girisYap, undefined);
  const [telefon, setTelefon] = useState("");
  const hata = durum && !durum.ok ? durum.mesaj : null;
  const hataVar = Boolean(hata);

  return (
    <form action={formAction} className="space-y-5">
      {/* Middleware'in eklediği dönüş yolu; sunucuda süzülmüş hâli. */}
      {geri && <input type="hidden" name="geri" value={geri} />}

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
          autoFocus
          aria-invalid={hataVar || undefined}
          aria-describedby={hataVar ? "giris-hata" : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="parola">Parola</Label>
        <Input
          id="parola"
          name="parola"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={hataVar || undefined}
          aria-describedby={hataVar ? "giris-hata" : undefined}
        />
        {hata && (
          <p
            id="giris-hata"
            role="alert"
            className="animate-fade flex items-start gap-1.5 pt-0.5 text-footnote font-medium text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{hata}</span>
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Giriş yapılıyor" : "Giriş yap"}
      </Button>
    </form>
  );
}
