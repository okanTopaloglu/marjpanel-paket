import type { Metadata } from "next";
import Link from "next/link";
import { guvenliGeriYolu } from "@/lib/auth/geri-yolu";
import { GirisForm } from "./giris-form";

export const metadata: Metadata = {
  // Kök şablon "%s | MAMA AURA Paket" ekler; marka burada tekrar yazılmaz.
  title: "Giriş",
  description: "MAMA AURA paket paneline giriş yapın.",
};

/**
 * GİRİŞ SAYFASI (sunucu bileşeni).
 *
 * Kabuk (marka, zemin, alt bilgi) `(auth)/layout.tsx` içinde; burası yalnız
 * KARTIN İÇİNİ tanımlar.
 *
 * İki karar sunucuda verilir ve forma PROP olarak iner:
 *  · `geri` — middleware'in eklediği dönüş yolu, açık yönlendirmeye karşı
 *    burada süzülür (istemciye ham searchParam hiç geçmez).
 *  · `kayitAcik` — `KAYIT_ACIK` bayrağı bir SUNUCU ortam değişkenidir;
 *    istemci bileşeni onu okuyamaz.
 */
export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ham = typeof sp.geri === "string" ? sp.geri : null;
  const geri = guvenliGeriYolu(ham);
  const kayitAcik = process.env.KAYIT_ACIK === "1";

  return (
    <>
      <div className="rounded-[--radius] border border-border bg-card p-6 shadow-soft sm:p-7">
        <h1 className="text-title-2 text-foreground">Giriş yap</h1>
        <p className="mt-1 text-footnote text-muted-foreground">
          Telefon numaranız ve parolanızla devam edin.
        </p>
        <div className="mt-6">
          <GirisForm geri={geri} />
        </div>
      </div>

      {/* Kayıt kapalıyken bağlantı hiç gösterilmez: kullanıcıyı "kayıt kapalı"
          kartına göndermek boş bir yolculuk olurdu. */}
      {kayitAcik && (
        <p className="mt-6 text-center text-footnote text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link
            href="/kayit"
            className="font-semibold text-[hsl(var(--vurgu-metin))] underline-offset-2 [@media(hover:hover)and(pointer:fine)]:hover:underline"
          >
            Şirketinizi kaydedin
          </Link>
        </p>
      )}
    </>
  );
}
