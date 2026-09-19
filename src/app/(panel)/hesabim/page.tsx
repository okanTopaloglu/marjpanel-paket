import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Receipt, Wallet } from "lucide-react";
import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { StatKarti } from "@/components/panel/stat-karti";
import { BosDurum } from "@/components/panel/bos-durum";
import { Rozet } from "@/components/ui/rozet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bakiyeOzeti, kesimler, odemeler_ } from "@/lib/db/repos/finans";
import { donemAdi } from "@/lib/finans/hesap";
import { para, sayi } from "@/lib/format/sayi";
import { tarih } from "@/lib/format/tarih";

export const metadata: Metadata = { title: "Hesabım" };
export const dynamic = "force-dynamic";

const DURUM: Record<string, { ad: string; ton: "notr" | "bilgi" | "basari" | "hata" }> = {
  taslak: { ad: "Hazırlanıyor", ton: "notr" },
  kesildi: { ad: "Ödeme bekliyor", ton: "bilgi" },
  odendi: { ad: "Ödendi", ton: "basari" },
  iptal: { ad: "İptal", ton: "hata" },
};

/**
 * HESABIM — kiracı yöneticisi: MarjPanel'e olan borcu, dönem dökümleri,
 * ödemeler. Taslaklar da görünür ("hazırlanıyor") ama tutar kesilene kadar
 * değişebilir. Kapsam: yalnız kendi şirketi.
 */
export default async function HesabimSayfasi() {
  const kapsam = await adminKapsamiZorunlu();
  const [ozet, liste, odemeListesi] = await Promise.all([
    bakiyeOzeti(kapsam.sirketId),
    kesimler(kapsam.sirketId),
    odemeler_(kapsam.sirketId),
  ]);

  return (
    <>
      <SayfaBasligi baslik="Hesabım" aciklama="Depo hizmeti hesap kesimleri ve ödemeleriniz. Paket başı ücret dönem sonunda kesilir." />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatKarti etiket="Bakiye" deger={para(ozet.bakiye)} dipnot={Number(ozet.bakiye) > 0 ? "Ödenmemiş tutar" : "Borcunuz yok"} ikon={Wallet} />
        <StatKarti etiket="Toplam kesilen" deger={para(ozet.kesilen)} dipnot={`Ödenen ${para(ozet.odenen)}`} ikon={Receipt} />
        <StatKarti etiket="Gecikmiş" deger={sayi(ozet.gecikmis)} dipnot="Vadesi geçmiş kesim" ikon={AlertTriangle} />
      </div>

      {liste.length === 0 ? (
        <BosDurum ikon={Receipt} baslik="Henüz hesap kesimi yok" aciklama="İlk dönem sonunda paket sayınıza göre hesap kesilir ve burada görünür." />
      ) : (
        <div className="overflow-x-auto rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dönem</TableHead>
                <TableHead className="text-right">Paket</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead className="text-right">Kalan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liste.map((k) => {
                const r = DURUM[k.durum] ?? DURUM.taslak!;
                const kalan = k.durum === "kesildi" ? Number(k.genelToplam) - Number(k.odenen) : 0;
                return (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Link href={`/hesabim/${k.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {donemAdi(k.donem)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-right">{sayi(k.paketSayisi)}</TableCell>
                    <TableCell>
                      <Rozet ton={r.ton}>{r.ad}</Rozet>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">{k.faturaNo ?? "—"}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{k.vadeTarihi ? tarih(k.vadeTarihi) : "—"}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{k.durum === "iptal" ? "—" : para(k.genelToplam)}</TableCell>
                    <TableCell className={`tabular text-right ${kalan > 0.004 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{k.durum === "kesildi" ? para(kalan) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {odemeListesi.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-title-3">Ödemeler</h2>
          <div className="rounded-[--radius] border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Dönem</TableHead>
                  <TableHead>Yöntem</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {odemeListesi.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="tabular">{tarih(o.tarih)}</TableCell>
                    <TableCell>{o.donem ? donemAdi(o.donem) : "Genel"}</TableCell>
                    <TableCell>{o.yontem.replace("_", " ")}</TableCell>
                    <TableCell className="tabular text-right">{para(o.tutar)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
