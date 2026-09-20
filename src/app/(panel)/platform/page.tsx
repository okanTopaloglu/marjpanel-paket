import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Coins,
  Gauge,
  MousePointerClick,
  PackageOpen,
  Receipt,
  Eye,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { StatKarti } from "@/components/panel/stat-karti";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { genelPano } from "@/lib/db/repos/pano";
import { siteOzeti } from "@/lib/db/repos/site-olaylari";
import { donemAdi } from "@/lib/finans/hesap";
import { gunAnahtari, tarihSaat } from "@/lib/format/tarih";
import { para, sayi, ondalik } from "@/lib/format/sayi";
import { SiteGrafigi } from "./site-grafigi";

export const metadata: Metadata = { title: "Platform Yönetimi" };
export const dynamic = "force-dynamic";

/**
 * PLATFORM YÖNETİMİ — süper yöneticinin ana ekranı.
 *
 * Şirket paneli "bugün kaç paket çıktı" sorusuna bakar; bu sayfa
 * PLATFORMUN KENDİSİNE bakar: kaç şirket iş yapıyor, ne kazanıyoruz, tanıtım
 * sayfasına kim geliyor, kim iletişime geçiyor. İkisi ayrı sorular olduğu
 * için ayrı ekranlar.
 *
 * Süper yönetici buraya giriş yapar (bkz. (panel)/page.tsx yönlendirmesi) ve
 * buradan istediği şirketin paneline geçebilir.
 */

const ETIKETLER: Record<string, string> = {
  goruntuleme: "Sayfa görüntüleme",
  eposta: "E-posta tıklaması",
  telefon: "Telefon tıklaması",
  teklif: "Teklif isteği",
  kayit: "Kayıt düğmesi",
  giris: "Giriş düğmesi",
  sss: "SSS açılması",
};

function Kisayol({ href, baslik, aciklama, ikon: Ikon }: { href: string; baslik: string; aciklama: string; ikon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="press flex items-start gap-3 rounded-[--radius] border border-border bg-card p-4 transition-[border-color,background-color] duration-dokunma ease-out [@media(hover:hover)and(pointer:fine)]:hover:border-[hsl(var(--vurgu-parlak))] [@media(hover:hover)and(pointer:fine)]:hover:bg-accent"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[hsl(var(--vurgu-parlak))]">
        <Ikon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-title-3">{baslik}</span>
        <span className="mt-0.5 block text-footnote text-muted-foreground">{aciklama}</span>
      </span>
    </Link>
  );
}

export default async function PlatformSayfasi() {
  await superKapsamiZorunlu();
  const donem = gunAnahtari().slice(0, 7);
  const [pano, site] = await Promise.all([genelPano(donem), siteOzeti(30)]);

  const aktifSirket = pano.sirketler.filter((s) => s.donem > 0).length;

  return (
    <>
      <SayfaBasligi
        baslik="Platform Yönetimi"
        aciklama="Tüm şirketler, kazanç, tanıtım sayfası ziyaretleri ve iletişim talepleri tek ekranda."
      />

      {/* --------------------------------------------------------- İŞ HACMİ */}
      <h2 className="mb-3 text-title-3">{donemAdi(donem)} · iş ve kazanç</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKarti etiket="Şirket" deger={sayi(pano.sirketler.length)} dipnot={`${aktifSirket} tanesi bu dönem iş yaptı`} ikon={Building2} />
        <StatKarti etiket="Dönem paket" deger={sayi(pano.donemToplam)} dipnot={`bugün ${sayi(pano.bugunToplam)}`} ikon={Gauge} />
        <StatKarti etiket="Gelir tahmini" deger={para(pano.gelirTahmini)} dipnot="paket × tarife (KDV dâhil)" ikon={Coins} />
        <StatKarti etiket="Kâr tahmini" deger={para(pano.karTahmini)} dipnot={`sarf gideri ${para(pano.sarfGideri)}`} ikon={TrendingUp} />
      </div>

      {/* ------------------------------------------------------ TANITIM SİTE */}
      <h2 className="mb-1 text-title-3">Tanıtım sayfası · son 30 gün</h2>
      <p className="mb-3 text-footnote text-muted-foreground">
        Kendi ölçümümüz; çerez ya da kişisel veri tutulmaz. Arama sıralaması ve sorguları için Google Search
        Console bağlanacak.
      </p>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKarti etiket="Görüntüleme" deger={sayi(site.toplamGoruntuleme)} dipnot="tanıtım sayfası" ikon={Eye} />
        <StatKarti etiket="Etkileşim" deger={sayi(site.toplamEtkilesim)} dipnot="tıklama ve açılma" ikon={MousePointerClick} />
        <StatKarti etiket="Dönüşüm" deger={`%${ondalik(site.donusumPct)}`} dipnot="etkileşim / görüntüleme" ikon={TrendingUp} />
        <StatKarti
          etiket="İletişim talebi"
          deger={sayi(site.turBazinda.filter((t) => ["eposta", "telefon", "teklif"].includes(t.tur)).reduce((s, t) => s + t.adet, 0))}
          dipnot="e-posta, telefon, teklif"
          ikon={Coins}
        />
      </div>

      {site.toplamGoruntuleme === 0 ? (
        <p className="mb-6 rounded-[--radius] border border-border bg-card px-4 py-6 text-center text-footnote text-muted-foreground">
          Henüz ziyaret kaydı yok. Tanıtım sayfası yayına yeni girdi; ilk ziyaretçiden sonra burada grafik
          ve kırılımlar görünecek.
        </p>
      ) : (
        <div className="mb-6 space-y-4">
          <SiteGrafigi seri={site.gunlukSeri} />

          <div className="grid gap-4 lg:grid-cols-3">
            <KirilimKarti baslik="Olay türü" satirlar={site.turBazinda.map((t) => ({ ad: ETIKETLER[t.tur] ?? t.tur, adet: t.adet }))} />
            <KirilimKarti baslik="Nereden geldi" satirlar={site.yonlendirenler} bos="Tümü doğrudan giriş." />
            <KirilimKarti baslik="Cihaz" satirlar={site.cihazlar} />
          </div>

          {site.kampanyalar.length > 0 && (
            <KirilimKarti baslik="Kampanya (utm_campaign)" satirlar={site.kampanyalar} />
          )}

          {site.sonIletisim.length > 0 && (
            <div className="rounded-[--radius] border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-title-3">Son iletişim tıklamaları</h3>
                <p className="text-footnote text-muted-foreground">Kim olduğu bilinmez; yalnız ne zaman ve neye tıklandığı.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaman</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Hedef</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {site.sonIletisim.map((o, i) => (
                    <TableRow key={`${o.zaman.toISOString()}-${i}`}>
                      <TableCell className="tabular">{tarihSaat(o.zaman)}</TableCell>
                      <TableCell>{ETIKETLER[o.tur] ?? o.tur}</TableCell>
                      <TableCell className="tabular text-muted-foreground">{o.etiket ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------- ŞİRKETLER */}
      <h2 className="mb-3 text-title-3">Şirketler</h2>
      <div className="mb-6 overflow-x-auto rounded-[--radius] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Şirket</TableHead>
              <TableHead className="text-right">Bugün</TableHead>
              <TableHead className="text-right">Dönem</TableHead>
              <TableHead className="text-right">Gelir tahmini</TableHead>
              <TableHead className="text-right">Bakiye</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pano.sirketler.map((s) => (
              <TableRow key={s.sirketId}>
                <TableCell className="font-semibold">{s.sirketAd}</TableCell>
                <TableCell className="tabular text-right">{sayi(s.bugun)}</TableCell>
                <TableCell className="tabular text-right">{sayi(s.donem)}</TableCell>
                <TableCell className="tabular text-right">
                  {s.gelirTahmini === null ? <span className="text-warning">tarife yok</span> : para(s.gelirTahmini)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {para(s.bakiye)}
                  {s.gecikmis > 0 && <span className="ml-1 text-caption text-destructive">· {s.gecikmis} gecikmiş</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --------------------------------------------------------- KISAYOL */}
      <h2 className="mb-3 text-title-3">Platform işleri</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kisayol href="/sirketler" baslik="Şirketler" aciklama="Kiracı ekle, alan adı ve logo tanımla" ikon={Building2} />
        <Kisayol href="/pano" baslik="Genel Pano" aciklama="Çalışan yükü ve saat yoğunluğu" ikon={Gauge} />
        <Kisayol href="/hesap-kesimi" baslik="Hesap Kesimi" aciklama="Tarife tanımla, dönem kes, tahsilat işle" ikon={Receipt} />
        <Kisayol href="/sarf" baslik="Sarf Malzemeleri" aciklama="Koli, bant, poşet stoğu ve maliyeti" ikon={PackageOpen} />
        <Kisayol href="/mal-kabul" baslik="Mal Kabul" aciklama="Gelen ürünleri kaydet" ikon={PackageOpen} />
        <Kisayol href="/stok" baslik="Stoklar" aciklama="Tüm şirketlerin kalan adetleri" ikon={Gauge} />
      </div>
    </>
  );
}

function KirilimKarti({ baslik, satirlar, bos }: { baslik: string; satirlar: { ad: string; adet: number }[]; bos?: string }) {
  const azami = satirlar[0]?.adet ?? 0;
  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <h3 className="text-title-3">{baslik}</h3>
      {satirlar.length === 0 ? (
        <p className="mt-3 text-footnote text-muted-foreground">{bos ?? "Kayıt yok."}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {satirlar.slice(0, 8).map((s) => (
            <li key={s.ad}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-callout">{s.ad}</span>
                <span className="tabular shrink-0 text-callout font-semibold">{sayi(s.adet)}</span>
              </div>
              <div aria-hidden="true" className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${azami > 0 ? Math.round((s.adet / azami) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
