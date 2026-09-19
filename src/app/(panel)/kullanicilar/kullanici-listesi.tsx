"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Users } from "lucide-react";
import {
  kullaniciAktiflik,
  kullaniciSil,
} from "@/server/actions/kullanicilar";
import { telefonGorunum } from "@/lib/format/telefon";
import { Avatar } from "@/components/panel/avatar";
import { BosDurum } from "@/components/panel/bos-durum";
import { IslemlerMenusu, type IslemMaddesi } from "@/components/panel/islemler-menusu";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { Rozet } from "@/components/ui/rozet";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KullaniciFormu } from "./kullanici-formu";
import type { KullaniciListeSatiri } from "@/lib/db/repos/kullanicilar";
import type { KullaniciRolu, OkutmaModu } from "@/lib/db/schema";

const ROL_ETIKET: Record<KullaniciRolu, string> = {
  super_admin: "Platform yöneticisi",
  admin: "Yönetici",
  calisan: "Çalışan",
};

const ROL_TON: Record<KullaniciRolu, "bilgi" | "basari" | "notr"> = {
  super_admin: "bilgi",
  admin: "basari",
  calisan: "notr",
};

const OKUTMA_ETIKET: Record<OkutmaModu, string> = {
  hizli: "Hızlı",
  rehberli: "Rehberli",
  toplama: "Toplama",
};

/** Şirket filtresi (yalnız super_admin) — seçim `?sirket=` ile URL'e yazılır. */
function SirketFiltresi({
  sirketSecenekleri,
  seciliSirketId,
}: {
  sirketSecenekleri: { id: string; ad: string }[];
  seciliSirketId: string;
}) {
  const router = useRouter();
  return (
    <div className="max-w-xs">
      <Select
        aria-label="Şirkete göre filtrele"
        value={seciliSirketId}
        onChange={(e) => {
          const deger = e.target.value;
          router.push(deger ? `/kullanicilar?sirket=${deger}` : "/kullanicilar");
        }}
      >
        <option value="">Tüm şirketler</option>
        {sirketSecenekleri.map((s) => (
          <option key={s.id} value={s.id}>
            {s.ad}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function KullaniciListesi({
  satirlar,
  kendiId,
  superMi,
  sirketSecenekleri,
  seciliSirketId,
}: {
  satirlar: KullaniciListeSatiri[];
  kendiId: string;
  superMi: boolean;
  sirketSecenekleri: { id: string; ad: string }[];
  seciliSirketId: string;
}) {
  const [duzenlenen, setDuzenlenen] = useState<KullaniciListeSatiri | null>(null);
  const [silinecek, setSilinecek] = useState<KullaniciListeSatiri | null>(null);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {superMi && (
        <SirketFiltresi sirketSecenekleri={sirketSecenekleri} seciliSirketId={seciliSirketId} />
      )}

      {hataMesaji && (
        <p
          role="alert"
          className="animate-fade flex items-start gap-1.5 text-footnote font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{hataMesaji}</span>
        </p>
      )}

      {satirlar.length === 0 ? (
        <BosDurum
          ikon={Users}
          baslik="Henüz kullanıcı yok"
          aciklama="Sağ üstteki “Kullanıcı ekle” ile ilk çalışan ya da yönetici hesabını oluşturun."
        />
      ) : (
        <div className="rounded-[--radius] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Telefon</TableHead>
                {superMi && <TableHead>Şirket</TableHead>}
                <TableHead>Rol</TableHead>
                <TableHead>Okutma modu</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {satirlar.map((k) => {
                const kendisi = k.id === kendiId;
                const maddeler: IslemMaddesi[] = [
                  {
                    key: "duzenle",
                    etiket: "Düzenle",
                    onSelect: () => setDuzenlenen(k),
                  },
                  {
                    key: "aktiflik",
                    etiket: k.aktif ? "Pasifleştir" : "Aktifleştir",
                    onSelect: () => {
                      setHataMesaji(null);
                      startTransition(async () => {
                        const durum = await kullaniciAktiflik(k.id, !k.aktif);
                        if (!durum.ok) setHataMesaji(durum.mesaj ?? "İşlem başarısız.");
                      });
                    },
                  },
                  {
                    key: "sil",
                    etiket: "Sil",
                    tehlikeli: true,
                    pasif: kendisi,
                    onSelect: () => setSilinecek(k),
                  },
                ];

                return (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar ad={k.ad} profilGorsel={k.profilGorsel} boyut="sm" />
                        <span className="truncate text-headline text-foreground">
                          {k.ad}
                          {kendisi && (
                            <span className="ml-1.5 text-caption font-medium text-muted-foreground">
                              (siz)
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">
                      {telefonGorunum(k.telefon)}
                    </TableCell>
                    {superMi && (
                      <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                        {k.sirketAd}
                      </TableCell>
                    )}
                    <TableCell>
                      <Rozet ton={ROL_TON[k.rol]}>{ROL_ETIKET[k.rol]}</Rozet>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.okutmaModu ? OKUTMA_ETIKET[k.okutmaModu] : "Şirket varsayılanı"}
                    </TableCell>
                    <TableCell>
                      <Rozet ton={k.aktif ? "basari" : "notr"}>
                        {k.aktif ? "Aktif" : "Pasif"}
                      </Rozet>
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
      )}

      <KullaniciFormu
        acik={duzenlenen !== null}
        onKapat={() => setDuzenlenen(null)}
        kullanici={duzenlenen ?? undefined}
        superMi={superMi}
        kendiId={kendiId}
        sirketSecenekleri={sirketSecenekleri}
      />

      <OnayDiyalogu
        acik={silinecek !== null}
        baslik={`${silinecek?.ad ?? ""} silinsin mi?`}
        aciklama="Bu kullanıcı ve okutma geçmişindeki adı kalır, ancak hesabıyla artık giriş yapılamaz. Bu işlem geri alınamaz."
        onaylaMetni="Sil"
        tehlikeli
        onKapat={() => setSilinecek(null)}
        onOnay={() => {
          if (!silinecek) return;
          const id = silinecek.id;
          setSilinecek(null);
          setHataMesaji(null);
          startTransition(async () => {
            const durum = await kullaniciSil(id);
            if (!durum.ok) setHataMesaji(durum.mesaj ?? "Kullanıcı silinemedi.");
          });
        }}
      />

      {pending && <span className="sr-only" role="status">İşleniyor…</span>}
    </div>
  );
}
