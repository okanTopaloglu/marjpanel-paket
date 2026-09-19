"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { superKapsami } from "@/lib/auth/yetki";
import { kalemleriAyristir, satirlariBirlestir, type KalemGirdisi } from "@/lib/depo/kalem-ayristir";
import { olustur, sil } from "@/lib/db/repos/mal-kabul";
import type { EylemDurumu } from "./auth";

/**
 * MAL KABUL EYLEMLERİ — yalnız super_admin (depo MarjPanel'indir; kiracı
 * kendi malını kabul edemez, depo sayar). Kalemler iki yoldan gelir ve aynı
 * ayrıştırıcıdan geçer: form satırları (`satirlar` JSON) ve yapıştırılan
 * metin (`yapistir`). İkisi birleştirilir, tekrar eden barkod toplanır.
 */
const YETKISIZ = "Bu işlem için yetkiniz yok.";

const semasi = z.object({
  sirketId: z.string().uuid("Şirket seçin."),
  tur: z.enum(["kabul", "iade", "duzeltme"]),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  irsaliyeNo: z.string().trim().max(60).optional().default(""),
  not: z.string().trim().max(500).optional().default(""),
  satirlar: z.string().optional().default("[]"),
  yapistir: z.string().optional().default(""),
});

export async function malKabulKaydet(
  _onceki: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await superKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ };

  const cozum = semasi.safeParse({
    sirketId: formData.get("sirketId") ?? "",
    tur: formData.get("tur") ?? "kabul",
    tarih: formData.get("tarih") ?? "",
    irsaliyeNo: formData.get("irsaliyeNo") ?? "",
    not: formData.get("not") ?? "",
    satirlar: formData.get("satirlar") ?? "[]",
    yapistir: formData.get("yapistir") ?? "",
  });
  if (!cozum.success) {
    const ilk = cozum.error.issues[0];
    return { ok: false, mesaj: ilk?.message ?? "Form geçersiz.", alanlar: { [String(ilk?.path[0] ?? "")]: ilk?.message ?? "" } };
  }
  const v = cozum.data;
  const isaretli = v.tur === "duzeltme";

  let satirlar: { barkod: unknown; adet: unknown }[] = [];
  try {
    const ham = JSON.parse(v.satirlar) as unknown;
    if (Array.isArray(ham)) satirlar = ham as { barkod: unknown; adet: unknown }[];
  } catch {
    return { ok: false, mesaj: "Satırlar okunamadı." };
  }

  const a = satirlariBirlestir(satirlar, { isaretli });
  const b = kalemleriAyristir(v.yapistir, { isaretli });
  const hatalar = [...a.hatalar, ...b.hatalar.map((h) => ({ ...h, satir: h.satir }))];
  if (hatalar.length) {
    return {
      ok: false,
      mesaj: `${hatalar.length} satır geçersiz: ${hatalar
        .slice(0, 3)
        .map((h) => `"${h.metin}" (${h.neden})`)
        .join(" · ")}${hatalar.length > 3 ? " …" : ""}`,
    };
  }

  const birlesik = new Map<string, number>();
  for (const k of [...a.kalemler, ...b.kalemler]) birlesik.set(k.barkod, (birlesik.get(k.barkod) ?? 0) + k.adet);
  if (birlesik.size === 0) return { ok: false, mesaj: "En az bir kalem girin." };

  // İade stoktan DÜŞER: kullanıcı pozitif yazar, işaret burada verilir.
  const kalemler: KalemGirdisi[] = [...birlesik.entries()].map(([barkod, adet]) => ({
    barkod,
    adet: v.tur === "iade" ? -Math.abs(adet) : adet,
  }));

  // Tarih: İstanbul günü öğlen olarak kaydedilir (gün sınırı kaymasın).
  const tarih = new Date(`${v.tarih}T12:00:00+03:00`);

  await olustur(kapsam, {
    sirketId: v.sirketId,
    tur: v.tur,
    tarih,
    irsaliyeNo: v.irsaliyeNo || null,
    not: v.not || null,
    kalemler,
  });

  revalidatePath("/mal-kabul");
  revalidatePath("/stok");
  const toplam = kalemler.reduce((t, k) => t + k.adet, 0);
  return { ok: true, mesaj: `Fiş kaydedildi: ${kalemler.length} kalem, ${toplam > 0 ? "+" : ""}${toplam} adet.` };
}

export async function malKabulSil(id: string): Promise<EylemDurumu> {
  const kapsam = await superKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ };
  const silindi = await sil(id);
  revalidatePath("/mal-kabul");
  revalidatePath("/stok");
  return silindi ? { ok: true, mesaj: "Fiş silindi." } : { ok: false, mesaj: "Fiş bulunamadı." };
}
