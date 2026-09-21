"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { teklifGonder, teklifWhatsappIsaretle, type TeklifSonucu } from "@/server/actions/teklif";
import { telefonMaske } from "@/lib/format/telefon";

/**
 * TEKLİF FORMU — iki adım, sonunda WhatsApp.
 *
 *   1) Telefon (tek alan, en düşük sürtünme)
 *   2) Detaylar (ad, şirket, hacim, pazaryerleri, not)
 *   3) Kaydedildi → WhatsApp'a yönlendir
 *
 * NEDEN İKİ ADIM: tek bir uzun form ziyaretçiyi ilk bakışta kaçırır. Telefon
 * ilk adımda alınır ve İKİNCİ ADIMA GEÇMEDEN DE elimizdedir değil — kayıt
 * yalnız form gönderilince yazılır, ama alanların çoğu isteğe bağlı olduğu
 * için kişi "Devam"a basıp hemen gönderebilir. Böylece en kötü senaryoda bile
 * telefon numarası bize ulaşır.
 *
 * WHATSAPP'A GİTMEK ZORUNLU DEĞİL: kayıt zaten yazıldı. Gitmezse panelde
 * "WhatsApp'a gitmedi" olarak görünür ve aranacak listeye düşer.
 */

type Adim = "telefon" | "detay" | "tamam";

export function TeklifFormu({ kaynak, kampanya }: { kaynak?: string; kampanya?: string }) {
  const [adim, setAdim] = useState<Adim>("telefon");
  const [telefon, setTelefon] = useState("");
  const [durum, eylem, bekliyor] = useActionState<TeklifSonucu | undefined, FormData>(
    teklifGonder,
    undefined,
  );
  const acildi = useRef(false);

  useEffect(() => {
    if (durum?.ok && durum.whatsappUrl) {
      setAdim("tamam");
      /*
       * Yeni sekmede aç. Aynı sekmede açsaydık kişi WhatsApp'tan dönünce
       * formu kaybederdi; ayrıca açılış engellenirse buton yine elinde olur.
       */
      if (!acildi.current) {
        acildi.current = true;
        const pencere = window.open(durum.whatsappUrl, "_blank", "noopener,noreferrer");
        if (pencere && durum.talepId) void teklifWhatsappIsaretle(durum.talepId);
      }
    }
  }, [durum]);

  if (adim === "tamam" && durum?.ok) {
    return (
      <div className="rounded-[--radius] border border-[hsl(var(--vurgu-parlak))] bg-accent/40 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[hsl(var(--vurgu-parlak))]" aria-hidden="true" />
        <h3 className="mt-3 text-title-2 font-bold tracking-[-0.02em]">Talebiniz bize ulaştı</h3>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground">
          WhatsApp penceresi açılmadıysa aşağıdaki düğmeye basın. Açmasanız da size
          döneceğiz.
        </p>
        {durum.whatsappUrl && (
          <a
            href={durum.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => durum.talepId && void teklifWhatsappIsaretle(durum.talepId)}
            className="press mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[--radius-kontrol] bg-primary px-6 text-[0.9375rem] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp&apos;tan devam et
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={eylem} className="rounded-[--radius] border border-border bg-card p-6 shadow-soft sm:p-7">
      <h3 className="text-title-2 font-bold tracking-[-0.02em]">Depo hizmeti için teklif alın</h3>
      <p className="mt-1.5 text-footnote text-muted-foreground">
        {adim === "telefon"
          ? "Telefon numaranızı bırakın, size dönelim. İkinci adımda birkaç soru daha var."
          : "Birkaç bilgi daha; hepsi isteğe bağlı. Gönderince WhatsApp'a yönlendirileceksiniz."}
      </p>

      {/* Telefon her iki adımda da formda kalır (ikinci adımda gizli). */}
      <div className={adim === "telefon" ? "mt-5" : "hidden"}>
        <label htmlFor="teklif-telefon" className="text-overline text-muted-foreground">
          Telefon
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="teklif-telefon"
              name="telefon"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={telefon}
              onChange={(e) => setTelefon(telefonMaske(e.target.value))}
              placeholder="0532 123 45 67"
              className="tabular h-11 w-full rounded-[--radius-kontrol] border border-input bg-background pl-9 pr-3 text-[0.9375rem] outline-none focus-visible:border-[hsl(var(--vurgu-parlak))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--vurgu-parlak))]/25"
            />
          </div>
          <button
            type="button"
            onClick={() => telefon.replace(/\D/g, "").length >= 10 && setAdim("detay")}
            className="press inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[--radius-kontrol] bg-primary px-5 text-[0.9375rem] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Devam
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {adim === "detay" && (
        <>
          <input type="hidden" name="telefon" value={telefon} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Alan ad="ad" etiket="Ad soyad" yer="Adınız" otomatik="name" />
            <Alan ad="sirket" etiket="Şirket" yer="Şirket adınız" otomatik="organization" />
            <Alan ad="eposta" etiket="E-posta" tip="email" yer="ornek@firma.com" otomatik="email" />
            <Alan ad="aylikPaket" etiket="Aylık paket (tahmini)" yer="Örn. 500-1000" />
            <div className="sm:col-span-2">
              <Alan ad="pazaryerleri" etiket="Hangi pazaryerleri" yer="Trendyol, Hepsiburada..." />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="teklif-mesaj" className="text-overline text-muted-foreground">
                Eklemek istedikleriniz
              </label>
              <textarea
                id="teklif-mesaj"
                name="mesaj"
                rows={3}
                maxLength={500}
                placeholder="Ürün tipiniz, özel istekleriniz..."
                className="mt-1.5 w-full rounded-[--radius-kontrol] border border-input bg-background px-3 py-2 text-[0.9375rem] outline-none focus-visible:border-[hsl(var(--vurgu-parlak))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--vurgu-parlak))]/25"
              />
            </div>
          </div>

          <input type="hidden" name="kaynak" value={kaynak ?? ""} />
          <input type="hidden" name="kampanya" value={kampanya ?? ""} />

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="submit"
              disabled={bekliyor}
              className="press inline-flex h-11 items-center justify-center gap-2 rounded-[--radius-kontrol] bg-primary px-6 text-[0.9375rem] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {bekliyor ? "Gönderiliyor" : "Gönder ve WhatsApp'a geç"}
            </button>
            <button
              type="button"
              onClick={() => setAdim("telefon")}
              className="press inline-flex h-11 items-center justify-center rounded-[--radius-kontrol] border border-input bg-card px-5 text-[0.9375rem] font-medium text-muted-foreground hover:bg-muted"
            >
              Geri
            </button>
          </div>
          <p className="mt-3 text-caption text-muted-foreground">
            Bilgileriniz yalnız size teklif vermek için kullanılır, üçüncü kişilerle paylaşılmaz.
          </p>
        </>
      )}

      {durum && !durum.ok && durum.mesaj && (
        <p role="alert" className="mt-4 flex items-start gap-1.5 text-footnote font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{durum.mesaj}</span>
        </p>
      )}
    </form>
  );
}

function Alan({
  ad,
  etiket,
  yer,
  tip = "text",
  otomatik,
}: {
  ad: string;
  etiket: string;
  yer?: string;
  tip?: string;
  otomatik?: string;
}) {
  return (
    <div>
      <label htmlFor={`teklif-${ad}`} className="text-overline text-muted-foreground">
        {etiket}
      </label>
      <input
        id={`teklif-${ad}`}
        name={ad}
        type={tip}
        placeholder={yer}
        autoComplete={otomatik}
        className="mt-1.5 h-11 w-full rounded-[--radius-kontrol] border border-input bg-background px-3 text-[0.9375rem] outline-none focus-visible:border-[hsl(var(--vurgu-parlak))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--vurgu-parlak))]/25"
      />
    </div>
  );
}
