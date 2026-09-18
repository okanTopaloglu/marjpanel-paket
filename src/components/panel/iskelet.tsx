import { cn } from "@/lib/utils";

/**
 * Yükleme iskeletleri.
 *
 * Apple §1: gecikme gizlenmez, ama tepki ANINDA verilir. Sunucu render'ı
 * sürerken kullanıcı boş bir ekrana ya da eski sayfaya bakmaz — gelecek
 * içeriğin şekli gösterilir, böylece bekleme "donmuş" değil "yükleniyor"
 * olarak okunur ve sayfa geldiğinde yerleşim zıplamaz.
 */
export function Iskelet({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** Sayfa başlığı + açıklama bloğu. */
export function IskeletBaslik() {
  return (
    <div className="space-y-2.5">
      <Iskelet className="h-8 w-52" />
      <Iskelet className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Özet kartı şeridi. */
export function IskeletKartlar({ adet = 4 }: { adet?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: adet }, (_, i) => (
        <div
          key={i}
          className="rounded-[--radius] border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <Iskelet className="h-3 w-24" />
              <Iskelet className="h-8 w-16" />
              <Iskelet className="h-3 w-32" />
            </div>
            <Iskelet className="h-10 w-10 rounded-[--radius-kontrol]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tablo kartı. */
export function IskeletTablo({ satir = 8 }: { satir?: number }) {
  return (
    <div className="rounded-[--radius] border border-border bg-card p-4 sm:p-5">
      <div className="space-y-2">
        <Iskelet className="h-4 w-40" />
        <Iskelet className="h-3 w-64 max-w-full" />
      </div>
      <div className="mt-5 space-y-2.5">
        <Iskelet className="h-8 w-full" />
        {Array.from({ length: satir }, (_, i) => (
          <Iskelet
            key={i}
            className="h-9 w-full"
            // Satırlar aynı anda değil, dalga hâlinde parlasın.
          />
        ))}
      </div>
    </div>
  );
}

/** Panel sayfaları için varsayılan yükleme düzeni. */
export function IskeletSayfa() {
  return (
    <div className="animate-fade space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Yükleniyor…</span>
      <IskeletBaslik />
      <IskeletKartlar />
      <IskeletTablo />
    </div>
  );
}
