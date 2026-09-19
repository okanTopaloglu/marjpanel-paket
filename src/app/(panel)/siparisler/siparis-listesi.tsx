"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Printer, ShoppingCart } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Rozet, PazaryeriRozeti } from "@/components/ui/rozet";
import { Kopyalanabilir } from "@/components/ui/kopyala";
import { BosDurum } from "@/components/panel/bos-durum";
import { DurumSekmeleri } from "@/components/panel/durum-sekmeleri";
import { FiltreCubugu, type FiltreGrubu } from "@/components/panel/filtre-cubugu";
import { SayfaGezinme } from "@/components/tables/sayfa-gezinme";
import { tarihSaat } from "@/lib/format/tarih";
import {
  GORUNEN_DURUM_ETIKETI,
  SEKMELER,
  SEKME_ETIKETI,
  type GorunenDurum,
  type Sekme,
} from "@/lib/siparis/durum";
import type { SayfaSonucu, SekmeSayilari, SiparisSatiri } from "@/lib/db/repos/siparisler";
import { SiparisDetay } from "./siparis-detay";

/**
 * SİPARİŞ LİSTESİ.
 *
 * FİLTRELER URL'DE TUTULUR: sunucu sayfası `searchParams`'tan okur, böylece
 * sayfa yenilendiğinde, link paylaşıldığında ve tarayıcı geri tuşuna
 * basıldığında aynı liste gelir. Filtre bileşeni URL'i kendisi yazmaz
 * (bkz. FiltreCubugu başlığı) - o karar sayfaya aittir ve burada verilir.
 *
 * ETİKET YAZDIRMA `window.open` İLE VE TIK İŞLEYİCİSİNİN İÇİNDE, SENKRON
 * ÇAĞRILIR. `await`ten sonra açılan pencereyi tarayıcı "kullanıcı jesti
 * olmadan açıldı" sayıp engeller; bu, PartnerSys'te "yazdır düğmesi bazen
 * çalışmıyor" şikâyetinin sebebiydi.
 */
const TON: Record<GorunenDurum, "basari" | "bilgi" | "uyari" | "hata"> = {
  kargoda: "basari",
  hazir: "bilgi",
  bekleyen: "uyari",
  iptal: "hata",
};

export function SiparisListesi({
  sonuc,
  sayilar,
  kargolar,
  entegrasyonlar,
  platformlar,
  secili,
}: {
  sonuc: SayfaSonucu;
  sayilar: SekmeSayilari;
  kargolar: string[];
  entegrasyonlar: string[];
  platformlar: string[];
  secili: {
    sekme: Sekme;
    platform: string;
    arama: string;
    kargo: string;
    entegrasyon: string;
  };
}) {
  const router = useRouter();
  const yol = usePathname();
  const aramaParametreleri = useSearchParams();
  const [secimler, setSecimler] = useState<Set<string>>(new Set());
  const [acikDetay, setAcikDetay] = useState<string | null>(null);

  /** Tek bir parametreyi değiştirir; sayfa numarası her filtre değişiminde sıfırlanır. */
  const guncelle = useCallback(
    (degisiklikler: Record<string, string>, sayfaSifirla = true) => {
      const p = new URLSearchParams(aramaParametreleri.toString());
      for (const [anahtar, deger] of Object.entries(degisiklikler)) {
        if (deger) p.set(anahtar, deger);
        else p.delete(anahtar);
      }
      if (sayfaSifirla) p.delete("sayfa");
      router.replace(`${yol}?${p.toString()}`, { scroll: false });
    },
    [aramaParametreleri, router, yol],
  );

  const gruplar = useMemo<FiltreGrubu[]>(() => {
    const liste: FiltreGrubu[] = [];
    if (platformlar.length > 1) {
      liste.push({
        anahtar: "platform",
        baslik: "Pazaryeri",
        tip: "tekli",
        deger: secili.platform,
        onChange: (d) => guncelle({ platform: d }),
        secenekler: platformlar.map((p) => ({ deger: p, etiket: p })),
      });
    }
    if (kargolar.length > 0) {
      liste.push({
        anahtar: "kargo",
        baslik: "Kargo firması",
        tip: "tekli",
        deger: secili.kargo,
        onChange: (d) => guncelle({ kargo: d }),
        secenekler: kargolar.map((k) => ({ deger: k, etiket: k })),
      });
    }
    if (entegrasyonlar.length > 0) {
      liste.push({
        anahtar: "entegrasyon",
        baslik: "Mağaza",
        tip: "tekli",
        deger: secili.entegrasyon,
        onChange: (d) => guncelle({ entegrasyon: d }),
        secenekler: entegrasyonlar.map((e) => ({ deger: e, etiket: e })),
      });
    }
    return liste;
  }, [platformlar, kargolar, entegrasyonlar, secili, guncelle]);

  const sekmeler = useMemo(
    () =>
      SEKMELER.map((s) => ({
        key: s,
        etiket: SEKME_ETIKETI[s],
        adet: sayilar[s],
      })),
    [sayilar],
  );

  const secimAc = (satir: SiparisSatiri, isaretli: boolean) => {
    setSecimler((onceki) => {
      const yeni = new Set(onceki);
      if (isaretli) yeni.add(satir.id);
      else yeni.delete(satir.id);
      return yeni;
    });
  };

  const sayfadakiSecim = sonuc.satirlar.filter((s) => secimler.has(s.id));
  const hepsiSecili =
    sonuc.satirlar.length > 0 && sayfadakiSecim.length === sonuc.satirlar.length;

  function etiketYazdir() {
    // Seçili kayıt yoksa düğme zaten pasif; savunma amaçlı kontrol.
    if (secimler.size === 0) return;
    const adres = `/etiket?siparis=${[...secimler].join(",")}`;
    window.open(adres, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <DurumSekmeleri
        sekmeler={sekmeler}
        secili={secili.sekme}
        onSecim={(s) => guncelle({ sekme: s === "tumu" ? "" : s })}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <FiltreCubugu
            gruplar={gruplar}
            arama={{
              deger: secili.arama,
              onChange: (d) => guncelle({ arama: d }),
              yerTutucu: "Sipariş no veya takip no",
            }}
            onTemizle={
              secili.platform || secili.kargo || secili.entegrasyon || secili.arama
                ? () =>
                    guncelle({ platform: "", kargo: "", entegrasyon: "", arama: "" })
                : undefined
            }
          />
        </div>
        <Button
          type="button"
          size="lg"
          disabled={secimler.size === 0}
          onClick={etiketYazdir}
        >
          <Printer aria-hidden="true" />
          Etiket yazdır ({secimler.size})
        </Button>
      </div>

      {sonuc.satirlar.length === 0 ? (
        <BosDurum
          ikon={ShoppingCart}
          baslik="Bu kutuda sipariş yok"
          aciklama="Filtreyi değiştirin ya da Entegrasyonlar sayfasından mağazanızı bağlayıp senkronu bekleyin; yeni siparişler birkaç dakika içinde düşer."
        />
      ) : (
        <div className="rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Sayfadaki tüm siparişleri seç"
                    className="h-4 w-4 cursor-pointer accent-[hsl(var(--vurgu))]"
                    checked={hepsiSecili}
                    onChange={(olay) =>
                      setSecimler((onceki) => {
                        const yeni = new Set(onceki);
                        for (const s of sonuc.satirlar) {
                          if (olay.target.checked) yeni.add(s.id);
                          else yeni.delete(s.id);
                        }
                        return yeni;
                      })
                    }
                  />
                </TableHead>
                <TableHead>Sipariş no</TableHead>
                <TableHead>Pazaryeri</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Kargo firması</TableHead>
                <TableHead>Takip no</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Yazdırıldı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sonuc.satirlar.map((s) => (
                <TableRow
                  key={s.id}
                  data-state={secimler.has(s.id) ? "selected" : undefined}
                  className="group/kopya cursor-pointer"
                  onClick={() => setAcikDetay(s.id)}
                >
                  <TableCell onClick={(olay) => olay.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${s.siparisNo ?? s.siparisKimligi} siparişini seç`}
                      className="h-4 w-4 cursor-pointer accent-[hsl(var(--vurgu))]"
                      checked={secimler.has(s.id)}
                      onChange={(olay) => secimAc(s, olay.target.checked)}
                    />
                  </TableCell>
                  <TableCell className="tabular font-semibold">
                    {s.siparisNo ?? s.siparisKimligi}
                  </TableCell>
                  <TableCell>
                    <PazaryeriRozeti platform={s.platform} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    {s.asgari.musteriAd}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.kargoFirmasi ?? "-"}
                  </TableCell>
                  <TableCell className="tabular" onClick={(o) => o.stopPropagation()}>
                    {s.kargoTakipNo ? (
                      <Kopyalanabilir deger={s.kargoTakipNo}>
                        {s.kargoTakipNo}
                      </Kopyalanabilir>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {tarihSaat(s.siparisTarihi)}
                  </TableCell>
                  <TableCell>
                    <Rozet ton={TON[s.gorunenDurum]}>
                      {GORUNEN_DURUM_ETIKETI[s.gorunenDurum]}
                    </Rozet>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {s.yazdirmaZamani ? tarihSaat(s.yazdirmaZamani) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-footnote text-muted-foreground">
          Toplam <span className="tabular font-semibold">{sonuc.toplam}</span> sipariş
        </p>
        <SayfaGezinme
          sayfa={sonuc.sayfa}
          sayfaSayisi={sonuc.sayfaSayisi}
          onSayfa={(n) => guncelle({ sayfa: n > 0 ? String(n) : "" }, false)}
        />
      </div>

      <SiparisDetay siparisId={acikDetay} onKapat={() => setAcikDetay(null)} />
    </div>
  );
}
