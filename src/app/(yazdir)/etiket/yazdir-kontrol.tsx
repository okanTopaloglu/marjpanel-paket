"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { yazdirildiIsaretle } from "@/server/actions/siparisler";

/**
 * Yazdırma araç çubuğu (ekranda kalır, kâğıda basılmaz).
 *
 * Sayfa açılınca yazdırma diyaloğunu BİR KEZ otomatik açar; barkodlar
 * `useEffect` içinde çizildiği için kısa bir gecikme gerekir, aksi hâlde
 * diyalog boş etiketlerle açılır.
 *
 * `afterprint` sonrası siparişler "yazdırıldı" işaretlenir. İşaretleme
 * DİYALOG KAPANINCA yapılır, düğmeye basılınca değil: kullanıcı diyalogu iptal
 * ederse de işaretlenir (tarayıcı "iptal" ile "bastı"yı ayırt ettirmez) - bu
 * bilinçli bir ödünleşmedir ve elle "Yazdırıldı olarak işaretle" düğmesi de
 * durur, çünkü sessizce işaretlememek "hangisini bastım" sorusunu depoya
 * bırakırdı.
 */
export function YazdirKontrol({ ids }: { ids: string[] }) {
  const [isaretlendi, setIsaretlendi] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const isaretleniyorRef = useRef(false);
  const otomatikAcildi = useRef(false);

  const isaretle = useCallback(() => {
    if (isaretleniyorRef.current || ids.length === 0) return;
    isaretleniyorRef.current = true;
    void yazdirildiIsaretle(ids).then((cevap) => {
      if (cevap.ok) {
        setIsaretlendi(true);
        setMesaj(cevap.mesaj ?? null);
      } else {
        isaretleniyorRef.current = false;
        setMesaj(cevap.mesaj ?? null);
      }
    });
  }, [ids]);

  useEffect(() => {
    const sonra = () => isaretle();
    window.addEventListener("afterprint", sonra);
    const zamanlayici = setTimeout(() => {
      if (otomatikAcildi.current || ids.length === 0) return;
      otomatikAcildi.current = true;
      window.print();
    }, 600);
    return () => {
      window.removeEventListener("afterprint", sonra);
      clearTimeout(zamanlayici);
    };
  }, [ids.length, isaretle]);

  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
      <Button type="button" size="lg" onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        Yazdır
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isaretlendi || ids.length === 0}
        onClick={isaretle}
      >
        Yazdırıldı olarak işaretle
      </Button>
      <span className="text-footnote text-muted-foreground">
        {ids.length} etiket hazır; her etiket ayrı sayfaya basılır.
      </span>
      {isaretlendi && (
        <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {mesaj ?? "Yazdırıldı olarak işaretlendi"}
        </span>
      )}
    </div>
  );
}
