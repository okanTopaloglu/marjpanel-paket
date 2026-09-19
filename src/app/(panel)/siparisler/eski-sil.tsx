"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnayDiyalogu } from "@/components/panel/onay-diyalogu";
import { eskileriSil } from "@/server/actions/siparisler";

/** Alt sınır: repo ve eylem de aynı sınırı uygular (7 günden yenisi silinmez). */
const ASGARI_GUN = 7;

/**
 * Eski sipariş temizliği.
 *
 * İKİ KAPI: gün sayısı 7'nin altına inemez (alan `min`, sunucu da doğrular) ve
 * silme onay diyaloğundan geçer. Hazırlanmamış, hâlâ havuzda bekleyen
 * siparişler tarihleri ne olursa olsun silinmez - bunu kullanıcıya diyalogda
 * söylüyoruz, çünkü "20 günden eskiyi sil" diyen kişi depodaki paketin
 * kaybolmayacağını bilmelidir.
 */
export function EskiSil() {
  const [gun, setGun] = useState("30");
  const [acik, setAcik] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const sayi = Number(gun);
  const gecerli = Number.isFinite(sayi) && sayi >= ASGARI_GUN;

  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <h2 className="text-title-3">Eski siparişleri temizle</h2>
      <p className="mt-1 text-footnote text-muted-foreground">
        Belirttiğiniz günden eski, kargoya verilmiş ya da kapanmış siparişleri
        siler. Depoda hâlâ bekleyen paketler silinmez.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-32">
          <label
            htmlFor="eski-gun"
            className="mb-1.5 block text-caption text-muted-foreground"
          >
            Kaç günden eski
          </label>
          <Input
            id="eski-gun"
            type="number"
            min={ASGARI_GUN}
            value={gun}
            onChange={(olay) => setGun(olay.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!gecerli || bekliyor}
          onClick={() => setAcik(true)}
        >
          <Trash2 aria-hidden="true" />
          Temizle
        </Button>
        {!gecerli && (
          <p className="text-footnote text-destructive">
            En az {ASGARI_GUN} gün girilmeli.
          </p>
        )}
        {mesaj && (
          <p role="status" className="text-footnote text-success">
            {mesaj}
          </p>
        )}
      </div>

      <OnayDiyalogu
        acik={acik}
        tehlikeli
        baslik={`${sayi} günden eski siparişler silinsin mi?`}
        aciklama="Bu işlem geri alınamaz. Hazırlanmamış ve hâlâ bekleyen siparişler silinmez."
        onaylaMetni="Siparişleri sil"
        onKapat={() => setAcik(false)}
        onOnay={() => {
          setAcik(false);
          setMesaj(null);
          basla(async () => {
            const cevap = await eskileriSil(sayi);
            setMesaj(cevap.mesaj ?? null);
          });
        }}
      />
    </div>
  );
}
