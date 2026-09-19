"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tarayıcı yazdırma — kesim dökümü için PDF'e kaydetme yolu. */
export function YazdirButonu() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Yazdır / PDF
    </Button>
  );
}
