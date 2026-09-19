"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Trash2, Upload } from "lucide-react";
import { profilGorseliSil, profilGorseliYukle } from "@/server/actions/profil";
import { gorseliSikistir } from "@/lib/gorsel/sikistir";
import { Avatar } from "@/components/panel/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const IZINLI_TURLER = new Set(["image/jpeg", "image/png", "image/webp"]);
const AZAMI_BOYUT = 2 * 1024 * 1024;

/**
 * Profil görseli — dosya İSTEMCİDE sıkıştırılır (`gorseliSikistir`, PartnerSys
 * `imageCompression.ts` portu) ve öyle yüklenir: 400px uzun kenar + %70 JPEG
 * kalitesiyle çoğu telefon fotoğrafı birkaç yüz KB'a düşer, sunucuya ham
 * dosya (bazen 10+ MB) hiç gitmez.
 */
export function ProfilGorseli({
  ad,
  profilGorsel,
}: {
  ad: string;
  profilGorsel: string | null;
}) {
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const girisRef = useRef<HTMLInputElement | null>(null);

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya) return;
    setHata(null);

    if (!IZINLI_TURLER.has(dosya.type)) {
      setHata("Yalnız JPEG, PNG ya da WEBP görseller kabul edilir.");
      return;
    }
    if (dosya.size > AZAMI_BOYUT) {
      setHata("Görsel en fazla 2 MB olabilir.");
      return;
    }

    try {
      const sikisik = await gorseliSikistir(dosya);
      const url = URL.createObjectURL(sikisik);
      setOnizleme((eski) => {
        if (eski) URL.revokeObjectURL(eski);
        return url;
      });

      const formData = new FormData();
      formData.set("gorsel", sikisik, "profil.jpg");
      startTransition(async () => {
        const durum = await profilGorseliYukle(formData);
        if (!durum.ok) setHata(durum.mesaj ?? "Görsel yüklenemedi.");
      });
    } catch {
      setHata("Görsel işlenemedi. Lütfen başka bir dosya deneyin.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil görseli</CardTitle>
        <CardDescription>Kabuktaki avatarınızda görünür.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Avatar
          ad={ad}
          profilGorsel={onizleme ? null : profilGorsel}
          boyut="lg"
          className={onizleme ? "hidden" : "h-20 w-20 text-title-2"}
        />
        {onizleme && (
          // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (object URL), next/image gerekmez.
          <img
            src={onizleme}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        )}

        <input
          ref={girisRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={dosyaSecildi}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        <div className="flex w-full flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => girisRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Görsel yükle
          </Button>
          {(profilGorsel || onizleme) && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setHata(null);
                setOnizleme((eski) => {
                  if (eski) URL.revokeObjectURL(eski);
                  return null;
                });
                startTransition(async () => {
                  const durum = await profilGorseliSil();
                  if (!durum.ok) setHata(durum.mesaj ?? "Görsel kaldırılamadı.");
                });
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Kaldır
            </Button>
          )}
        </div>

        <p className="text-caption text-muted-foreground">JPEG, PNG ya da WEBP, en fazla 2 MB.</p>

        {hata && (
          <p
            role="alert"
            className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{hata}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
