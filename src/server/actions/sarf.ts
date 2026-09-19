"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { superKapsami } from "@/lib/auth/yetki";
import { hareketEkle, kaydet, sil } from "@/lib/db/repos/sarf";
import type { EylemDurumu } from "./auth";

/** SARF EYLEMLERİ — yalnız super_admin (depo malzemesi MarjPanel'indir). */
const YETKISIZ = "Bu işlem için yetkiniz yok.";
const sayi = (mesaj: string) => z.preprocess((v) => String(v ?? "").replace(",", "."), z.coerce.number({ invalid_type_error: mesaj }));

const sarfSemasi = z.object({
  id: z.union([z.string().uuid(), z.literal("")]),
  ad: z.string().trim().min(2, "Ad en az 2 karakter.").max(60),
  birim: z.string().trim().min(1).max(20),
  birimMaliyet: sayi("Birim maliyet sayı olmalı.").pipe(z.number().min(0)),
  paketBasiNorm: sayi("Norm sayı olmalı.").pipe(z.number().min(0)),
  normBaslangic: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  kritikSeviye: sayi("Kritik seviye sayı olmalı.").pipe(z.number().min(0)),
  aktif: z.union([z.literal("on"), z.literal(""), z.null()]).optional().transform((d) => d === "on"),
});

export async function sarfKaydet(_o: EylemDurumu | undefined, formData: FormData): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const c = sarfSemasi.safeParse({
    id: formData.get("id") ?? "",
    ad: formData.get("ad") ?? "",
    birim: formData.get("birim") ?? "adet",
    birimMaliyet: formData.get("birimMaliyet") ?? "0",
    paketBasiNorm: formData.get("paketBasiNorm") ?? "0",
    normBaslangic: formData.get("normBaslangic") ?? "",
    kritikSeviye: formData.get("kritikSeviye") ?? "0",
    aktif: formData.get("aktif"),
  });
  if (!c.success) return { ok: false, mesaj: c.error.issues[0]?.message ?? "Form geçersiz." };
  try {
    await kaydet(c.data.id || null, { ...c.data });
  } catch (hata) {
    const m = hata instanceof Error ? hata.message : String(hata);
    return { ok: false, mesaj: /unique|duplicate/i.test(m) ? "Bu adla bir sarf malzemesi zaten var." : "Kaydedilemedi." };
  }
  revalidatePath("/sarf");
  revalidatePath("/pano");
  return { ok: true, mesaj: c.data.id ? "Sarf malzemesi güncellendi." : "Sarf malzemesi eklendi." };
}

export async function sarfSil(id: string): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const s = await sil(id);
  revalidatePath("/sarf");
  return s ? { ok: true, mesaj: "Silindi." } : { ok: false, mesaj: "Bulunamadı." };
}

const hareketSemasi = z.object({
  sarfId: z.string().uuid(),
  tur: z.enum(["alim", "sayim", "duzeltme"]),
  miktar: sayi("Miktar sayı olmalı."),
  tutar: z.union([z.literal(""), sayi("Tutar sayı olmalı.").pipe(z.number().min(0))]),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  not: z.string().trim().max(300).optional().default(""),
});

export async function sarfHareketKaydet(_o: EylemDurumu | undefined, formData: FormData): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const c = hareketSemasi.safeParse({
    sarfId: formData.get("sarfId") ?? "",
    tur: formData.get("tur") ?? "alim",
    miktar: formData.get("miktar") ?? "",
    tutar: formData.get("tutar") ?? "",
    tarih: formData.get("tarih") ?? "",
    not: formData.get("not") ?? "",
  });
  if (!c.success) return { ok: false, mesaj: c.error.issues[0]?.message ?? "Form geçersiz." };
  const v = c.data;
  if (v.tur === "alim" && v.miktar <= 0) return { ok: false, mesaj: "Alım miktarı sıfırdan büyük olmalı." };
  if (v.tur === "sayim" && v.miktar < 0) return { ok: false, mesaj: "Sayılan miktar eksi olamaz." };
  if (v.tur === "duzeltme" && v.miktar === 0) return { ok: false, mesaj: "Düzeltme sıfır olamaz." };

  const { kaydedilen } = await hareketEkle({
    sarfId: v.sarfId,
    tur: v.tur,
    miktar: v.miktar,
    tutar: v.tutar === "" ? null : v.tutar,
    tarih: v.tarih,
    not: v.not || null,
    kaydedenAd: k.ad,
  });
  revalidatePath("/sarf");
  revalidatePath("/pano");
  return {
    ok: true,
    mesaj: v.tur === "sayim" ? `Sayım kaydedildi (fark ${kaydedilen > 0 ? "+" : ""}${kaydedilen}).` : "Hareket kaydedildi.",
  };
}
