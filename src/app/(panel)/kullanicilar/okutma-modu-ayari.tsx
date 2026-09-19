"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { sirketOkutmaModuKaydet } from "@/server/actions/kullanicilar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { OkutmaModu } from "@/lib/db/schema";

const ACIKLAMALAR: Record<OkutmaModu, string> = {
  hizli: "Barkod okutulur okutulmaz kaydedilir. En hızlı akış, ek bilgi göstermez.",
  rehberli: "Okutulan paketin sipariş içeriği (ürün adı, adet) ekranda gösterilir.",
  toplama: "Paketler önce toplama havuzuna düşer; çalışan kargo firmasına göre üstlenir.",
};

const SECENEKLER: { deger: OkutmaModu; etiket: string }[] = [
  { deger: "hizli", etiket: "Hızlı" },
  { deger: "rehberli", etiket: "Rehberli" },
  { deger: "toplama", etiket: "Toplama" },
];

/**
 * Şirketin varsayılan okutma modu — kullanıcı bazında ayarlanmadıysa
 * (`kullanicilar.okutmaModu = NULL`) bu mod geçerli olur (`etkinOkutmaModu`).
 * Yalnız admin görür; kaydedince liste sayfası yeniden doğrulanır.
 */
export function OkutmaModuAyari({ mevcutMod }: { mevcutMod: OkutmaModu }) {
  const [mod, setMod] = useState<OkutmaModu>(mevcutMod);
  const [mesaj, setMesaj] = useState<{ tur: "basari" | "hata"; metin: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Varsayılan okutma modu</CardTitle>
        <CardDescription>
          Kendi modunu seçmemiş çalışanlar için geçerli olan şirket varsayılanı.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-xs">
          <Select
            value={mod}
            disabled={pending}
            onChange={(e) => {
              const yeni = e.target.value as OkutmaModu;
              setMod(yeni);
              setMesaj(null);
              startTransition(async () => {
                const durum = await sirketOkutmaModuKaydet(yeni);
                setMesaj({ tur: durum.ok ? "basari" : "hata", metin: durum.mesaj ?? "" });
              });
            }}
          >
            {SECENEKLER.map((s) => (
              <option key={s.deger} value={s.deger}>
                {s.etiket}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-footnote text-muted-foreground">{ACIKLAMALAR[mod]}</p>
        {mesaj && (
          <p
            role="status"
            className={
              "animate-fade flex items-start gap-1.5 text-footnote font-medium " +
              (mesaj.tur === "basari" ? "text-success" : "text-destructive")
            }
          >
            {mesaj.tur === "basari" ? (
              <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{mesaj.metin}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
