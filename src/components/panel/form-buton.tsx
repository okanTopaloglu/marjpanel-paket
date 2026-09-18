"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Server-action formları için GÖNDER butonu.
 *
 * NEDEN VAR: `<form action={serverAction}><button>` düz butonlar basınca hiçbir
 * görsel geri bildirim vermiyordu — kullanıcı sonucu göremeyip tekrar tekrar
 * basıyor ("bir basıyor bir basmıyor"), her tık ayrı bir action tetikliyordu.
 * `useFormStatus` ile buton, ait olduğu form gönderilirken KENDİLİĞİNDEN
 * devre dışı kalır ve dönen ikon gösterir; çift-tık imkânsızlaşır. Client
 * bileşendir ama server action'ı prop olarak DEĞİL, sarmalayan `<form>`dan
 * bağlam olarak okur — sunucu bileşeni içindeki form'da doğrudan kullanılır.
 */
export function FormGonderButonu({
  children,
  className,
  yukleniyorMetni,
}: {
  children: React.ReactNode;
  className?: string;
  /** Gönderim sırasında gösterilecek metin (verilmezse çocuklar kalır). */
  yukleniyorMetni?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 transition-opacity disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {yukleniyorMetni ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
