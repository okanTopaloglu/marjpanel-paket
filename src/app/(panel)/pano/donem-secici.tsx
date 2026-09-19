"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { donemAdi } from "@/lib/finans/hesap";

export function DonemSecici({ donem }: { donem: string }) {
  const router = useRouter();
  const yol = usePathname();
  const liste: string[] = [];
  const simdi = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(Date.UTC(simdi.getUTCFullYear(), simdi.getUTCMonth() - i, 1));
    liste.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <Select value={donem} onChange={(e) => router.push(`${yol}?donem=${e.target.value}`)} aria-label="Dönem" className="w-44">
      {liste.map((d) => (
        <option key={d} value={d}>
          {donemAdi(d)}
        </option>
      ))}
    </Select>
  );
}
