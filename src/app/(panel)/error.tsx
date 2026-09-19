"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KiraciFiligran } from "@/components/marka/kiraci-markasi";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Geliştirme/gözlem için konsola yaz (prod'da sunucu logu ayrı tutulur).
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <h2 className="mt-4 text-title-2 text-foreground">Bir şeyler ters gitti</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        İşlem tamamlanamadı. Sayfayı yenileyin veya tekrar deneyin. Sorun sürerse
        yöneticinize bildirin.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Kod: {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline" className="mt-4">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Tekrar dene
      </Button>
      <KiraciFiligran className="mt-8" etiket="Paket paneli" />
    </div>
  );
}
