"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Building2, ExternalLink } from "lucide-react";
import { sirketSil } from "@/server/actions/sirketler";
import { BosDurum } from "@/components/panel/bos-durum";
import { IslemlerMenusu, type IslemMaddesi } from "@/components/panel/islemler-menusu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { Rozet } from "@/components/ui/rozet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SirketFormu } from "./sirket-formu";
import type { SirketSayimli } from "@/lib/db/repos/sirketler";

const sayiFormat = new Intl.NumberFormat("tr-TR");

export function SirketListesi({
  satirlar,
  kendiSirketId,
}: {
  satirlar: SirketSayimli[];
  kendiSirketId: string;
}) {
  const [duzenlenen, setDuzenlenen] = useState<SirketSayimli | null>(null);
  const [silinecek, setSilinecek] = useState<SirketSayimli | null>(null);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (satirlar.length === 0) {
    return (
      <BosDurum
        ikon={Building2}
        baslik="Henüz şirket yok"
        aciklama="Sağ üstteki “Şirket ekle” ile platformdaki ilk kiracıyı oluşturun."
      />
    );
  }

  return (
    <div className="space-y-4">
      {hataMesaji && (
        <p
          role="alert"
          className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hataMesaji}</span>
        </p>
      )}

      <div className="rounded-[--radius] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Şirket</TableHead>
              <TableHead>Alan adı</TableHead>
              <TableHead className="text-right">Kullanıcı</TableHead>
              <TableHead className="text-right">Okutma</TableHead>
              <TableHead className="text-right">Entegrasyon</TableHead>
              <TableHead className="text-right">Sipariş</TableHead>
              <TableHead>Azami entegrasyon</TableHead>
              <TableHead>Özellikler</TableHead>
              <TableHead className="w-9" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map((s) => {
              const kendiSirketiMi = s.id === kendiSirketId;
              const maddeler: IslemMaddesi[] = [
                { key: "duzenle", etiket: "Düzenle", onSelect: () => setDuzenlenen(s) },
                {
                  key: "sil",
                  etiket: "Sil",
                  tehlikeli: true,
                  pasif: kendiSirketiMi,
                  aciklama: kendiSirketiMi ? "Kendi şirketiniz" : undefined,
                  onSelect: () => setSilinecek(s),
                },
              ];

              return (
                <TableRow key={s.id}>
                  <TableCell className="text-headline text-foreground">{s.ad}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {/* Alan adı tanımlıysa süper yönetici tek tıkla o şirketin
                        paneline geçer; oturum çerezi host'a bağlı olduğu için
                        orada yeniden giriş ister (bilerek: kiracı adresinde
                        kimin oturumu olduğu belirsiz kalmasın). */}
                    {s.alanAdi ? (
                      <a
                        href={`https://${s.alanAdi}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[hsl(var(--vurgu-metin))] underline-offset-4 hover:underline"
                      >
                        {s.alanAdi}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {sayiFormat.format(s.kullaniciSayisi)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {sayiFormat.format(s.okutmaSayisi)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {sayiFormat.format(s.entegrasyonSayisi)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {sayiFormat.format(s.siparisSayisi)}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {s.azamiEntegrasyon == null ? "Sınırsız" : sayiFormat.format(s.azamiEntegrasyon)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Rozet ton={s.faturaPaylasAcik ? "basari" : "notr"}>Fatura paylaşım</Rozet>
                      <Rozet ton={s.faturaKesimAcik ? "basari" : "notr"}>Fatura kesim</Rozet>
                      <Rozet ton={s.mailAcik ? "basari" : "notr"}>Mail</Rozet>
                    </div>
                  </TableCell>
                  <TableCell>
                    <IslemlerMenusu maddeler={maddeler} yalnizIkon />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SirketFormu
        acik={duzenlenen !== null}
        onKapat={() => setDuzenlenen(null)}
        sirket={duzenlenen ?? undefined}
      />

      <OnayDiyalogu
        acik={silinecek !== null}
        baslik={`${silinecek?.ad ?? ""} silinsin mi?`}
        aciklama="Şirketin tüm kullanıcıları, okutma geçmişi, ürünleri, entegrasyonları ve siparişleri birlikte silinir. Bu işlem geri alınamaz."
        onaylaMetni="Sil"
        tehlikeli
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          if (!silinecek) return;
          const id = silinecek.id;
          setSilinecek(null);
          setHataMesaji(null);
          startTransition(async () => {
            const durum = await sirketSil(id);
            if (!durum.ok) setHataMesaji(durum.mesaj ?? "Şirket silinemedi.");
          });
        }}
      />
    </div>
  );
}
