"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { AlertCircle, Trash2, Upload } from "lucide-react";
import { sirketLogoSil, sirketLogoYukle } from "@/server/actions/sirketler";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const IZINLI = new Set(["image/png", "image/webp", "image/jpeg"]);
const AZAMI = 1024 * 1024;

/**
 * Şirket logosu — iki yuva: açık zemin (giriş kartı, üst çubuk) ve koyu
 * zemin (mürekkep menü). Koyu yüklenmezse menüde açık logo beyaz plakada
 * gösterilir; bu yüzden ikincisi isteğe bağlıdır ama önerilir.
 *
 * Süper yönetici şirket formunda, şirket yöneticisi Ayarlar'da kullanır;
 * `sirketId` yalnız süper yöneticide dolu gelir (eylem admin için formdaki
 * kimliği okumaz).
 */
export function SirketLogoAlani({
  sirketId,
  logoAcik,
  logoKoyu,
  className,
}: {
  sirketId?: string;
  logoAcik: string | null;
  logoKoyu: string | null;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <LogoYuvasi
        tur="acik"
        sirketId={sirketId}
        mevcut={logoAcik}
        baslik="Logo (açık zemin)"
        aciklama="Giriş kartı ve üst çubukta. Saydam PNG, en fazla 1 MB."
      />
      <LogoYuvasi
        tur="koyu"
        sirketId={sirketId}
        mevcut={logoKoyu}
        baslik="Logo (koyu zemin)"
        aciklama="Mürekkep menüde. Yoksa açık logo beyaz plakada gösterilir."
      />
    </div>
  );
}

function LogoYuvasi({
  tur,
  sirketId,
  mevcut,
  baslik,
  aciklama,
}: {
  tur: "acik" | "koyu";
  sirketId?: string;
  mevcut: string | null;
  baslik: string;
  aciklama: string;
}) {
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, basla] = useTransition();
  const girisRef = useRef<HTMLInputElement | null>(null);
  const koyu = tur === "koyu";
  const gosterilen = onizleme ?? mevcut;

  function secildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya) return;
    setHata(null);
    if (!IZINLI.has(dosya.type)) return setHata("Yalnız PNG, WEBP ya da JPEG.");
    if (dosya.size > AZAMI) return setHata("Logo en fazla 1 MB olabilir.");

    const url = URL.createObjectURL(dosya);
    setOnizleme((eski) => {
      if (eski) URL.revokeObjectURL(eski);
      return url;
    });
    const fd = new FormData();
    fd.set("gorsel", dosya);
    fd.set("tur", tur);
    if (sirketId) fd.set("sirketId", sirketId);
    basla(async () => {
      const d = await sirketLogoYukle(fd);
      if (!d.ok) setHata(d.mesaj ?? "Logo yüklenemedi.");
    });
  }

  return (
    <div className="rounded-[--radius-kontrol] border border-border p-3">
      <div className="text-footnote font-semibold text-foreground">{baslik}</div>
      <p className="mt-0.5 text-caption text-muted-foreground">{aciklama}</p>

      <div
        className={cn(
          "mt-3 flex h-16 items-center justify-center rounded-md border border-dashed",
          koyu ? "border-white/20 bg-ink" : "border-border bg-background",
        )}
      >
        {gosterilen ? (
          <Image
            src={gosterilen}
            alt=""
            width={0}
            height={0}
            sizes="100vw"
            unoptimized
            className="h-9 w-auto max-w-[85%] object-contain"
          />
        ) : (
          <span className={cn("text-caption", koyu ? "text-ink-foreground/50" : "text-muted-foreground")}>
            Logo yok
          </span>
        )}
      </div>

      <input
        ref={girisRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        onChange={secildi}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => girisRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {gosterilen ? "Değiştir" : "Yükle"}
        </Button>
        {gosterilen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setHata(null);
              setOnizleme((eski) => {
                if (eski) URL.revokeObjectURL(eski);
                return null;
              });
              basla(async () => {
                const d = await sirketLogoSil(sirketId ?? "", tur);
                if (!d.ok) setHata(d.mesaj ?? "Logo kaldırılamadı.");
              });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Kaldır
          </Button>
        )}
      </div>

      {hata && (
        <p role="alert" className="animate-fade mt-2 flex items-start gap-1.5 text-footnote font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hata}</span>
        </p>
      )}
    </div>
  );
}
