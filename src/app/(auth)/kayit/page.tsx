import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KayitForm } from "./kayit-form";

export const metadata: Metadata = {
  // Kök şablon markayı ekler; burada yalnız sayfa adı.
  title: "Kayıt",
  description: "Şirketinizi paket paneline kaydedin.",
};

/**
 * KAYIT SAYFASI.
 *
 * KAYIT_ACIK !== "1" iken form HİÇ ÇİZİLMEZ; yerine kısa bir "kayıt kapalı"
 * kartı gösterilir. Bu YALNIZCA ARAYÜZ GİZLEMESİDİR — asıl kilit
 * `sirketKaydet` eyleminin en başındadır, o da bayrağı ayrıca kontrol eder.
 */
export default function KayitSayfasi() {
  const acik = process.env.KAYIT_ACIK === "1";

  return (
    <>
      <div className="rounded-[--radius] border border-border bg-card p-6 shadow-soft sm:p-7">
        {acik ? (
          <>
            <h1 className="text-title-2 text-foreground">Şirketinizi kaydedin</h1>
            <p className="mt-1 text-footnote text-muted-foreground">
              İlk kullanıcı şirketin yöneticisi olur.
            </p>
            <div className="mt-6">
              <KayitForm />
            </div>
          </>
        ) : (
          <>
            <h1 className="flex items-center gap-2 text-title-2 text-foreground">
              <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              Kayıt kapalı
            </h1>
            <p className="mt-2 text-footnote text-muted-foreground">
              Kendi kendine kayıt şu anda açık değil. Hesap açılması için
              yöneticinizle görüşün.
            </p>
            <Button asChild size="lg" className="mt-6 w-full">
              <Link href="/giris">Giriş sayfasına dön</Link>
            </Button>
          </>
        )}
      </div>

      {acik && (
        <p className="mt-6 text-center text-footnote text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link
            href="/giris"
            className="font-semibold text-[hsl(var(--vurgu-metin))] underline-offset-2 [@media(hover:hover)and(pointer:fine)]:hover:underline"
          >
            Giriş yapın
          </Link>
        </p>
      )}
    </>
  );
}
