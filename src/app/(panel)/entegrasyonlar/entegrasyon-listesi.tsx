"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Pencil, Plug, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Rozet, PazaryeriRozeti } from "@/components/ui/rozet";
import { BosDurum } from "@/components/panel/bos-durum";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { goreliZaman } from "@/lib/format/tarih";
import {
  baglantiTest,
  entegrasyonSil,
  senkronBaslat,
} from "@/server/actions/entegrasyonlar";
import type { EntegrasyonOzeti } from "@/lib/db/repos/entegrasyonlar";
import { EntegrasyonFormu } from "./entegrasyon-formu";

/**
 * Entegrasyon kartları.
 *
 * TABLO DEĞİL KART: bir kullanıcının 1-3 entegrasyonu olur ve her satırda dört
 * eylem vardır (Test, Senkronla, Düzenle, Sil). Tabloda bu eylemler ya taşan
 * bir sütuna ya üç noktalı menüye sıkışırdı; kart her eylemi 44px hedefle
 * açıkta tutar.
 *
 * Test sonucu kartın İÇİNDE kalır: ayrı bir bildirim katmanı açmak, kullanıcı
 * hangi mağazayı test ettiğini unuttuğunda yanlış okunur.
 */
export function EntegrasyonListesi({ kayitlar }: { kayitlar: EntegrasyonOzeti[] }) {
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<EntegrasyonOzeti | null>(null);
  const [sonuc, setSonuc] = useState<Record<string, { ok: boolean; mesaj: string }>>({});
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [gecis, basla] = useTransition();

  if (kayitlar.length === 0) {
    return (
      <BosDurum
        ikon={Plug}
        baslik="Henüz bağlı mağaza yok"
        aciklama="Trendyol satıcı panelinizden aldığınız API anahtarı, gizli anahtar ve satıcı ID ile mağazanızı bağlayın; siparişler birkaç dakika içinde listeye düşer."
      />
    );
  }

  function eylemCalistir(
    id: string,
    isi: () => Promise<{ ok: boolean; mesaj?: string }>,
  ) {
    setBekleyen(id);
    basla(async () => {
      try {
        const cevap = await isi();
        setSonuc((o) => ({
          ...o,
          [id]: { ok: cevap.ok, mesaj: cevap.mesaj ?? (cevap.ok ? "Tamam." : "Hata.") },
        }));
      } finally {
        setBekleyen(null);
      }
    });
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {kayitlar.map((e) => {
          const cevap = sonuc[e.id];
          const mesgul = bekleyen === e.id && gecis;

          return (
            <div
              key={e.id}
              className="rounded-[--radius] border border-border bg-card p-4 shadow-soft sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-title-3 truncate">
                      {e.ad?.trim() || "Trendyol mağazası"}
                    </h2>
                    <PazaryeriRozeti platform={e.platform} />
                    <Rozet ton={e.aktif ? "basari" : "notr"}>
                      {e.aktif ? "Aktif" : "Pasif"}
                    </Rozet>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-footnote sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Satıcı ID</dt>
                      <dd className="tabular font-semibold">{e.saticiId}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">API anahtarı</dt>
                      <dd className="tabular font-semibold">{e.apiKeyMaskeli}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Son sipariş senkronu</dt>
                      <dd className="font-semibold">
                        {e.sonSiparisSenkron ? goreliZaman(e.sonSiparisSenkron) : "hiç"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Son ürün senkronu</dt>
                      <dd className="font-semibold">
                        {e.sonUrunSenkron ? goreliZaman(e.sonUrunSenkron) : "hiç"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {cevap && (
                <p
                  role="status"
                  className={`mt-3 flex items-start gap-1.5 text-footnote ${
                    cevap.ok ? "text-success" : "text-destructive"
                  }`}
                >
                  {cevap.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {cevap.mesaj}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={mesgul}
                  onClick={() => eylemCalistir(e.id, () => baglantiTest(e.id))}
                >
                  Bağlantıyı test et
                </Button>
                <Button
                  type="button"
                  variant="ink"
                  size="lg"
                  disabled={mesgul}
                  onClick={() => eylemCalistir(e.id, () => senkronBaslat(e.id))}
                >
                  <RefreshCw
                    className={mesgul ? "animate-spin" : undefined}
                    aria-hidden="true"
                  />
                  Senkronla
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setDuzenlenen(duzenlenen === e.id ? null : e.id)}
                >
                  <Pencil aria-hidden="true" />
                  Düzenle
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setSilinecek(e)}
                >
                  <Trash2 aria-hidden="true" />
                  Sil
                </Button>
              </div>

              {duzenlenen === e.id && (
                <div className="mt-4 border-t border-border pt-4">
                  <EntegrasyonFormu
                    duzenlenen={e}
                    onKapat={() => setDuzenlenen(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <OnayDiyalogu
        acik={!!silinecek}
        tehlikeli
        baslik="Entegrasyon silinsin mi?"
        aciklama={
          silinecek
            ? `${silinecek.ad?.trim() || "Trendyol mağazası"} (${silinecek.saticiId}) bağlantısı silinecek. Gelmiş siparişler listede kalır, yeni sipariş çekilmez.`
            : undefined
        }
        onaylaMetni="Entegrasyonu sil"
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          const hedef = silinecek;
          setSilinecek(null);
          if (hedef) eylemCalistir(hedef.id, () => entegrasyonSil(hedef.id));
        }}
      />
    </>
  );
}
