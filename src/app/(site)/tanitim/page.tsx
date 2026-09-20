import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  GitMerge,
  Mail,
  PackageCheck,
  Phone,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
} from "lucide-react";
import { Marka, MarkaYazi } from "@/components/marka/logo";
import { PazaryeriRozeti } from "@/components/ui/rozet";
import { istekHostu, platformHostu } from "@/lib/kiraci/coz";
import { platformHostuMu } from "@/lib/kiraci/kural";
import {
  ADIMLAR,
  ADRES,
  FARK_BASLIK,
  FARK_METNI,
  GIRIS_METNI,
  H1,
  HIZMETLER,
  ILETISIM_EPOSTA,
  META_ACIKLAMA,
  META_BASLIK,
  OZELLIKLER,
  PAZARYERI_SIRASI_TANITIM,
  SITE_ADI,
  SSS_LISTESI,
  TELEFONLAR,
} from "./icerik";
import { yapilandirilmisVeri } from "./yapilandirilmis-veri";

/**
 * TANITIM (ANASAYFA) — herkese açık tek pazarlama yüzeyi.
 *
 * Kök yolda (`/`) middleware rewrite'ı ile görünür; adres çubuğunda
 * `paket.marjpanel.com/` kalır (bkz. middleware.ts kök yol çatalı). Kendi
 * adresi `/tanitim` robots.txt'te kapalıdır - aynı içerik iki URL'de
 * dizine girmesin.
 *
 * SUNUCU BİLEŞENİ, İSTEMCİ JAVASCRIPT'İ YOK. Sayfada tek bir `useState` bile
 * yok: SSS açılır kapanır ama bu `<details>` ile, tarayıcının kendi işi.
 * Sebep tek kelimeyle LCP - tanıtım sayfası ilk izlenimdir ve bir pazarlama
 * sayfası için React hidrasyonu beklemek anlamsızdır.
 *
 * TASARIM: panelle AYNI sistem (Mürekkep & Nane). Ayrı bir "site teması",
 * gradyan, cam efekti ya da ikinci yazı tipi yok - DESIGN.md "Yasaklar".
 * Ziyaretçi paneli gördüğünde aynı yerde olduğunu anlamalı.
 */

export async function generateMetadata(): Promise<Metadata> {
  /*
   * CANONICAL HER ZAMAN PLATFORM KÖKÜ. İsteğin host'undan türetilseydi,
   * biri kiracı adresinden bu sayfaya ulaştığında canonical kendini
   * gösterir ve aynı içerik iki adrese bölünürdü.
   */
  const kok = `https://${platformHostu()}/`;
  return {
    /*
     * `absolute`: kök layout'ta `title.template` = "%s | MarjPanel Paket"
     * tanımlı (app/layout.tsx). Düz metin versek başlık "... | MarjPanel
     * Paket | MarjPanel Paket" diye iki kez damgalanırdı - marka adı zaten
     * META_BASLIK'ın içinde.
     */
    title: { absolute: META_BASLIK },
    description: META_ACIKLAMA,
    alternates: { canonical: kok },
    robots: { index: true, follow: true },
    keywords: [
      "e-ticaret depo hizmeti",
      "fulfillment",
      "paketleme hizmeti",
      "pazaryeri sipariş takibi",
      "barkod okutma",
      "trendyol entegrasyon",
      "depo yönetimi",
    ],
    openGraph: {
      type: "website",
      url: kok,
      siteName: SITE_ADI,
      locale: "tr_TR",
      title: META_BASLIK,
      description: META_ACIKLAMA,
      images: [{ url: `https://${platformHostu()}/og.png`, width: 1200, height: 630, alt: SITE_ADI }],
    },
    twitter: {
      card: "summary_large_image",
      title: META_BASLIK,
      description: META_ACIKLAMA,
      images: [`https://${platformHostu()}/og.png`],
    },
  };
}

const OZELLIK_IKONLARI = [CalendarClock, Boxes, ShieldCheck, Truck, Smartphone, PackageCheck];

export default async function TanitimSayfasi() {
  /*
   * KİRACI ADRESİNDE TANITIM YOK. sirket.marjpanel.com bir şirketin giriş
   * kapısıdır; oraya gelen kişi zaten müşteridir, ona hizmet pazarlanmaz.
   * Bu kontrol burada yapılır çünkü Edge middleware veritabanına bakamaz.
   */
  const host = await istekHostu();
  if (!platformHostuMu(host, platformHostu())) redirect("/giris");

  return (
    <>
      {/* JSON-LD: Organization, WebSite, WebPage, Service, SoftwareApplication, FAQPage, ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: yapilandirilmisVeri() }}
      />

      <div className="min-h-svh bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <span className="flex items-center gap-2.5">
              <Marka boyut={30} />
              <MarkaYazi className="text-title-3" altAd="Paket" />
            </span>
            <nav className="flex items-center gap-1.5" aria-label="Üst menü">
              <Link
                href="#sss"
                className="hidden min-h-touch items-center rounded-[--radius-kontrol] px-3 text-callout font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
              >
                Sık sorulanlar
              </Link>
              <Link
                href="/giris"
                className="press inline-flex h-9 items-center justify-center rounded-[--radius-kontrol] bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Panele giriş
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* ---------------------------------------------------------- HERO */}
          <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-20">
            <div className="max-w-3xl">
              <p className="text-overline font-semibold uppercase tracking-[0.12em] text-[hsl(var(--vurgu-metin))]">
                Depo hizmeti ve sipariş paneli
              </p>
              {/* LCP elemanı: metin. Görsel yok, font zaten yüklü. */}
              <h1 className="mt-3 text-balance text-[clamp(1.75rem,4.5vw,2.75rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-foreground">
                {H1}
              </h1>
              <p className="mt-5 max-w-2xl text-body text-muted-foreground">{GIRIS_METNI}</p>

              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  href="/kayit"
                  className="press inline-flex h-11 items-center justify-center gap-2 rounded-[--radius-kontrol] bg-primary px-6 text-[0.9375rem] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Ücretsiz hesap açın
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="#hizmetler"
                  className="press inline-flex h-11 items-center justify-center rounded-[--radius-kontrol] border border-input bg-card px-6 text-[0.9375rem] font-semibold text-foreground hover:bg-muted"
                >
                  Nasıl çalıştığını görün
                </Link>
              </div>

              <div className="mt-9">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Bağlanan pazaryerleri
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {PAZARYERI_SIRASI_TANITIM.map((p) => (
                    <PazaryeriRozeti key={p} platform={p} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- HİZMETLER */}
          <section id="hizmetler" className="border-t border-border bg-card py-14 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-title-1 font-bold tracking-[-0.02em]">İki şekilde çalışırız</h2>
              <p className="mt-2 max-w-2xl text-body text-muted-foreground">
                İşinizi bize devredin ya da yazılımı kendi deponuzda kullanın. İkisi de aynı
                sistemi paylaşır.
              </p>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {HIZMETLER.map((h, i) => (
                  <article
                    key={h.baslik}
                    className="rounded-[--radius] border border-border bg-background p-6 shadow-soft"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[hsl(var(--vurgu-parlak))]">
                      {i === 0 ? (
                        <Truck className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <ScanBarcode className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <h3 className="mt-4 text-title-2 font-bold tracking-[-0.02em]">{h.baslik}</h3>
                    <p className="mt-2 text-body text-muted-foreground">{h.ozet}</p>
                    <ul className="mt-5 space-y-2.5">
                      {h.maddeler.map((m) => (
                        <li key={m} className="flex gap-2.5 text-callout text-foreground">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--vurgu-parlak))]"
                            aria-hidden="true"
                          />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* --------------------------------------------------- FARKLILAŞMA */}
          <section className="py-14 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="rounded-[--radius] border border-[hsl(var(--vurgu-parlak))] bg-accent/40 p-6 sm:p-8">
                <div className="max-w-3xl">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <GitMerge className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-title-1 font-bold tracking-[-0.02em]">{FARK_BASLIK}</h2>
                  <p className="mt-2 text-body text-foreground">{FARK_METNI}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- ÖZELLİKLER */}
          <section className="py-14 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-title-1 font-bold tracking-[-0.02em]">
                Depoda gerçekten işe yarayan ayrıntılar
              </h2>
              <p className="mt-2 max-w-2xl text-body text-muted-foreground">
                Sipariş kaçırmamak ve yanlış paket göndermemek üzerine kurulu.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {OZELLIKLER.map((o, i) => {
                  const Ikon = OZELLIK_IKONLARI[i] ?? PackageCheck;
                  return (
                    <article
                      key={o.baslik}
                      className="rounded-[--radius] border border-border bg-card p-5"
                    >
                      <Ikon
                        className="h-5 w-5 text-[hsl(var(--vurgu-parlak))]"
                        aria-hidden="true"
                      />
                      <h3 className="mt-3 text-title-3 font-semibold">{o.baslik}</h3>
                      <p className="mt-1.5 text-footnote text-muted-foreground">{o.metin}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* -------------------------------------------------- NASIL ÇALIŞIR */}
          <section className="border-y border-border bg-card py-14 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-title-1 font-bold tracking-[-0.02em]">Nasıl çalışır</h2>
              <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {ADIMLAR.map((a, i) => (
                  <li
                    key={a.baslik}
                    className="rounded-[--radius] border border-border bg-background p-5"
                  >
                    <span className="tabular flex h-8 w-8 items-center justify-center rounded-full bg-ink text-headline font-bold text-ink-foreground">
                      {i + 1}
                    </span>
                    <h3 className="mt-3.5 text-title-3 font-semibold">{a.baslik}</h3>
                    <p className="mt-1.5 text-footnote text-muted-foreground">{a.metin}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ------------------------------------------------- BEYAZ ETİKET */}
          <section className="py-14 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="rounded-[--radius] border border-border bg-card p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[hsl(var(--vurgu-parlak))]">
                      <Users className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 className="mt-4 text-title-1 font-bold tracking-[-0.02em]">
                      Ekibiniz kendi markanızla giriş yapar
                    </h2>
                    <p className="mt-2 text-body text-muted-foreground">
                      Şirketiniz için ayrı bir adres tanımlanır ve panelde kendi logonuz görünür.
                      Çalışanlarınız sizin markanızı görür; altyapının MarjPanel Paket olduğu
                      bilgisi imza düzeyinde kalır.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-[--radius] border border-border bg-background px-5 py-4">
                    <p className="text-caption uppercase tracking-[0.06em] text-muted-foreground">
                      Giriş adresiniz
                    </p>
                    <p className="tabular mt-1 text-headline font-semibold text-foreground">
                      sirketiniz.marjpanel.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------- SSS */}
          <section id="sss" className="border-t border-border bg-card py-14 sm:py-20">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-title-1 font-bold tracking-[-0.02em]">Sık sorulan sorular</h2>
              <div className="mt-8 divide-y divide-border border-y border-border">
                {SSS_LISTESI.map((s) => (
                  /* <details>: açılır kapanır ama istemci JavaScript'i gerekmez
                     ve içerik DOM'da hep vardır - arama motoru gizli sanmaz. */
                  <details key={s.soru} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-headline font-semibold text-foreground">
                      <h3 className="text-headline font-semibold">{s.soru}</h3>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground transition-transform duration-dokunma group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-2.5 text-body text-muted-foreground">{s.cevap}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------- KAPANIŞ */}
          <section className="py-14 sm:py-20">
            <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
              <h2 className="text-title-1 font-bold tracking-[-0.02em]">
                Bugünün siparişlerini birlikte çıkaralım
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-body text-muted-foreground">
                Hesabınızı açın, mağazanızı bağlayın ve ilk paketinizi okutun. Depo hizmeti için
                teklif isteyin.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
                <Link
                  href="/kayit"
                  className="press inline-flex h-11 items-center justify-center gap-2 rounded-[--radius-kontrol] bg-primary px-6 text-[0.9375rem] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Ücretsiz hesap açın
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {/* Depo hizmeti teklifi e-postayla alınır; iletişim formu yok,
                    çünkü gelen kutusuna düşen gerçek bir adres daha hızlı. */}
                <a
                  href={`mailto:${ILETISIM_EPOSTA}?subject=${encodeURIComponent("Depo hizmeti teklif talebi")}`}
                  className="press inline-flex h-11 items-center justify-center gap-2 rounded-[--radius-kontrol] border border-input bg-card px-6 text-[0.9375rem] font-semibold text-foreground hover:bg-muted"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Teklif isteyin
                </a>
              </div>
              {/* Telefon `tel:` ile: mobilde tek dokunuşla arama açılır. */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-footnote">
                <a
                  href={`mailto:${ILETISIM_EPOSTA}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {ILETISIM_EPOSTA}
                </a>
                {TELEFONLAR.map((t) => (
                  <a
                    key={t.e164}
                    href={`tel:${t.e164}`}
                    className="tabular inline-flex items-center gap-1.5 font-semibold text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.gorunen}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border bg-card py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
            <span className="flex items-center gap-2">
              <Marka boyut={22} />
              <MarkaYazi className="text-callout" altAd="Paket" />
            </span>
            <p className="text-caption text-muted-foreground">
              Depo paket okutma ve pazaryeri sipariş takibi
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-caption">
              <a
                href={`mailto:${ILETISIM_EPOSTA}`}
                className="font-semibold text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline"
              >
                {ILETISIM_EPOSTA}
              </a>
              {TELEFONLAR.map((t) => (
                <a
                  key={t.e164}
                  href={`tel:${t.e164}`}
                  className="tabular font-semibold text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline"
                >
                  {t.gorunen}
                </a>
              ))}
            </div>
            {/* Adres HTML'de METİN olarak durur: yerel aramada Google sayfadaki
                adresi okur, yalnız JSON-LD'ye yazmak yeterli sinyal değildir. */}
            <address className="not-italic text-caption text-muted-foreground">
              {ADRES.tamMetin}
            </address>
          </div>
        </footer>
      </div>
    </>
  );
}
