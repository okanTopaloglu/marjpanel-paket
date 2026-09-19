"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Package, Trash2 } from "lucide-react";
import { Avatar } from "@/components/panel/avatar";
import { BosDurum } from "@/components/panel/bos-durum";
import { FiltreCubugu, type FiltreGrubu } from "@/components/panel/filtre-cubugu";
import { IslemlerMenusu } from "@/components/panel/islemler-menusu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { useAdminMi } from "@/components/panel/oturum-saglayici";
import { SayfaGezinme } from "@/components/tables/sayfa-gezinme";
import { Button } from "@/components/ui/button";
import { Kopyalanabilir } from "@/components/ui/kopyala";
import { Rozet } from "@/components/ui/rozet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tarihSaat } from "@/lib/format/tarih";
import type { FiltreSecenekleri, PaketSayfasi } from "@/lib/db/repos/paketler";
import {
  BOS_FILTRELER,
  SAYFA_LIMITI,
  filtreSorgusu,
  sayfaSayisi,
  type PaketFiltreleri,
} from "@/lib/paket/filtreler";
import { paketSil, paketleriSil } from "@/server/actions/paketler";

/**
 * PAKET LİSTESİ - tablo, filtreler ve (yöneticiye) silme.
 *
 * Filtre durumu BURADA TUTULMAZ: tek kaynak adres çubuğudur. Her değişiklik
 * `router.replace` ile adrese yazılır, sunucu bileşeni yeni veriyi getirir.
 * Böylece geri tuşu, yenileme ve bağlantı paylaşımı bedavaya çalışır ve iki
 * ayrı gerçeğin (yerel durum + URL) birbirine düşmesi imkânsız olur.
 *
 * Silme YALNIZ yöneticide: seçim kutuları ve satır menüsü çalışana hiç
 * çizilmez. Asıl kapı sunucudadır (`adminKapsami`), buradaki gizleme
 * kalabalığı azaltmak içindir.
 */
export function PaketListesi({
  sayfa,
  filtreler,
  secenekler,
  calisanMi,
}: {
  sayfa: PaketSayfasi;
  filtreler: PaketFiltreleri;
  secenekler: FiltreSecenekleri;
  /** `calisan` yalnız kendi satırlarını görür; kullanıcı filtresi çizilmez. */
  calisanMi: boolean;
}) {
  const router = useRouter();
  const yol = usePathname();
  const adminMi = useAdminMi();
  const [secili, setSecili] = useState<string[]>([]);
  const [tekSilme, setTekSilme] = useState<string | null>(null);
  const [topluOnay, setTopluOnay] = useState(false);
  const [calisiyor, gecisBaslat] = useTransition();

  const git = (yeni: PaketFiltreleri, sayfaNo = 0) => {
    const sorgu = filtreSorgusu(yeni, sayfaNo);
    setSecili([]);
    router.replace(sorgu ? `${yol}?${sorgu}` : yol);
  };

  const guncelle = (parca: Partial<PaketFiltreleri>) =>
    git({ ...filtreler, ...parca });

  const gruplar: FiltreGrubu[] = [
    {
      anahtar: "kaynak",
      baslik: "Kaynak",
      tip: "tekli",
      deger: filtreler.kaynak,
      onChange: (kaynak) => guncelle({ kaynak }),
      secenekler: secenekler.kaynaklar.map((k) => ({ deger: k, etiket: k })),
    },
    {
      anahtar: "kargo",
      baslik: "Kargo",
      tip: "tekli",
      deger: filtreler.kargo,
      onChange: (kargo) => guncelle({ kargo }),
      secenekler: secenekler.kargolar.map((k) => ({ deger: k, etiket: k })),
    },
    ...(calisanMi
      ? []
      : [
          {
            anahtar: "kullanici",
            baslik: "Okutan",
            tip: "tekli" as const,
            deger: filtreler.kullanici,
            onChange: (kullanici: string) => guncelle({ kullanici }),
            secenekler: secenekler.kullanicilar.map((k) => ({
              deger: k.id,
              etiket: k.ad,
            })),
          },
        ]),
    {
      anahtar: "baslangic",
      baslik: "Başlangıç",
      tip: "tarih",
      deger: filtreler.baslangic,
      onChange: (baslangic) => guncelle({ baslangic }),
    },
    {
      anahtar: "bitis",
      baslik: "Bitiş",
      tip: "tarih",
      deger: filtreler.bitis,
      onChange: (bitis) => guncelle({ bitis }),
    },
  ];

  const tumuSecili =
    sayfa.satirlar.length > 0 && secili.length === sayfa.satirlar.length;

  const sil = (id: string) =>
    gecisBaslat(async () => {
      await paketSil(id);
      setTekSilme(null);
      router.refresh();
    });

  const topluSil = () =>
    gecisBaslat(async () => {
      await paketleriSil(secili);
      setSecili([]);
      setTopluOnay(false);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <FiltreCubugu
        gruplar={gruplar}
        arama={{
          deger: filtreler.arama,
          onChange: (arama) => guncelle({ arama }),
          yerTutucu: "Barkod ara",
        }}
        onTemizle={() => git(BOS_FILTRELER)}
      />

      {adminMi && secili.length > 0 && (
        <div
          data-odak-serbest
          className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-border bg-card px-4 py-2.5"
        >
          <span className="tabular text-footnote text-muted-foreground">
            {secili.length} paket seçildi
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSecili([])}
            >
              Seçimi bırak
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setTopluOnay(true)}
              disabled={calisiyor}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Sil
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-[--radius] border border-border bg-card">
        {sayfa.satirlar.length === 0 ? (
          <BosDurum
            ikon={Package}
            baslik="Bu filtrelerde paket yok"
            aciklama="Paketler okutma ekranından kaydedilir. Filtreleri temizleyip tüm listeyi görebilirsiniz."
            aksiyon={
              <Button
                type="button"
                variant="outline"
                onClick={() => git(BOS_FILTRELER)}
              >
                Filtreleri temizle
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {adminMi && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Tümünü seç"
                      checked={tumuSecili}
                      onChange={(e) =>
                        setSecili(
                          e.target.checked ? sayfa.satirlar.map((s) => s.id) : [],
                        )
                      }
                      className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
                    />
                  </TableHead>
                )}
                <TableHead>Barkod</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Okutan</TableHead>
                <TableHead className="text-right">Zaman</TableHead>
                {adminMi && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>

            <TableBody>
              {sayfa.satirlar.map((s) => (
                <TableRow
                  key={s.id}
                  data-state={secili.includes(s.id) ? "selected" : undefined}
                >
                  {adminMi && (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`${s.barkod} satırını seç`}
                        checked={secili.includes(s.id)}
                        onChange={(e) =>
                          setSecili((onceki) =>
                            e.target.checked
                              ? [...onceki, s.id]
                              : onceki.filter((x) => x !== s.id),
                          )
                        }
                        className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
                      />
                    </TableCell>
                  )}

                  <TableCell className="tabular font-semibold">
                    <Kopyalanabilir deger={s.barkod}>{s.barkod}</Kopyalanabilir>
                  </TableCell>

                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {s.kaynak ? (
                        <Rozet>{s.kaynak}</Rozet>
                      ) : (
                        <Rozet ton="uyari">Bilinmiyor</Rozet>
                      )}
                      {s.kargoFirmasi && s.kargoFirmasi !== s.kaynak && (
                        <Rozet ton="bilgi">{s.kargoFirmasi}</Rozet>
                      )}
                      {s.entegrasyonAdi && (
                        <span className="text-caption text-muted-foreground">
                          {s.entegrasyonAdi}
                        </span>
                      )}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar
                        ad={s.okutanAd}
                        profilGorsel={s.profilGorsel}
                        boyut="sm"
                      />
                      <span className="truncate">{s.okutanAd}</span>
                    </span>
                  </TableCell>

                  <TableCell className="tabular whitespace-nowrap text-right text-muted-foreground">
                    {tarihSaat(s.okutmaZamani)}
                  </TableCell>

                  {adminMi && (
                    <TableCell>
                      <IslemlerMenusu
                        yalnizIkon
                        etiket={`${s.barkod} işlemleri`}
                        maddeler={[
                          {
                            key: "sil",
                            etiket: "Paketi sil",
                            ikon: Trash2,
                            tehlikeli: true,
                            onSelect: () => setTekSilme(s.id),
                          },
                        ]}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="tabular text-footnote text-muted-foreground">
          Toplam {sayfa.toplam} paket
        </span>
        <SayfaGezinme
          sayfa={sayfa.sayfa}
          sayfaSayisi={sayfaSayisi(sayfa.toplam, SAYFA_LIMITI)}
          onSayfa={(n) => git(filtreler, n)}
        />
      </div>

      <OnayDiyalogu
        acik={tekSilme !== null}
        baslik="Paket kaydı silinsin mi?"
        aciklama="Kayıt kalıcı olarak silinir ve vardiya sayımından düşer."
        onaylaMetni="Sil"
        tehlikeli
        onOnay={() => tekSilme && sil(tekSilme)}
        onKapat={() => setTekSilme(null)}
      />

      <OnayDiyalogu
        acik={topluOnay}
        baslik={`${secili.length} paket silinsin mi?`}
        aciklama="Seçili kayıtlar kalıcı olarak silinir ve vardiya sayımından düşer."
        onaylaMetni="Sil"
        tehlikeli
        onOnay={topluSil}
        onKapat={() => setTopluOnay(false)}
      />
    </div>
  );
}
