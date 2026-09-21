"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { superKapsami } from "@/lib/auth/yetki";
import { istemciIp, kayitDenemesiSay, KAYIT_HIZ_SINIRI_MESAJI } from "@/lib/guvenlik/hiz-siniri";
import { telefonNormalize } from "@/lib/format/telefon";
import { durumGuncelle, sil, teklifYaz, whatsappIsaretle } from "@/lib/db/repos/teklif";
import { teklifDurumuEnum } from "@/lib/db/schema";
import { WHATSAPP_NUMARASI } from "@/app/(site)/tanitim/icerik";
import type { EylemDurumu } from "./auth";

/**
 * TEKLİF TALEBİ EYLEMLERİ.
 *
 * Form HERKESE AÇIKTIR (oturum yok) — tanıtım sayfasındaki ziyaretçi doldurur.
 * Bu yüzden iki koruma var: IP başına hız sınırı (kayıt formuyla aynı sayaç)
 * ve alan uzunluk sınırları. Spam gelirse panelde silinebilir.
 */

const AZAMI_METIN = 500;

const semasi = z.object({
  telefon: z.string().trim().min(1, "Telefon gerekli."),
  ad: z.string().trim().max(80).optional().default(""),
  sirket: z.string().trim().max(80).optional().default(""),
  eposta: z.union([z.literal(""), z.string().trim().email("Geçerli bir e-posta girin.")]).optional().default(""),
  aylikPaket: z.string().trim().max(40).optional().default(""),
  pazaryerleri: z.string().trim().max(200).optional().default(""),
  mesaj: z.string().trim().max(AZAMI_METIN).optional().default(""),
  kaynak: z.string().trim().max(60).optional().default(""),
  kampanya: z.string().trim().max(60).optional().default(""),
});

/** Boş metni NULL'a çevir: veritabanında "" ile "verilmedi" karışmasın. */
const bosNull = (v: string): string | null => (v.trim() ? v.trim() : null);

export interface TeklifSonucu extends EylemDurumu {
  /** Kaydedilen talebin kimliği; WhatsApp yönlendirmesi bunu işaretler. */
  talepId?: string;
  /** Hazır WhatsApp bağlantısı (mesaj önceden doldurulmuş). */
  whatsappUrl?: string;
}

/**
 * Talebi KAYDEDER, sonra WhatsApp bağlantısını döner.
 *
 * SIRA ÖNEMLİ: önce veritabanı, sonra yönlendirme. Kişi WhatsApp'ı hiç
 * açmasa bile telefonu ve formu elimizde kalır - istenen davranış buydu.
 */
export async function teklifGonder(
  _onceki: TeklifSonucu | undefined,
  formData: FormData,
): Promise<TeklifSonucu> {
  const ip = istemciIp(await headers());
  if (kayitDenemesiSay(ip).engellendi) {
    return { ok: false, mesaj: KAYIT_HIZ_SINIRI_MESAJI };
  }

  const c = semasi.safeParse({
    telefon: formData.get("telefon") ?? "",
    ad: formData.get("ad") ?? "",
    sirket: formData.get("sirket") ?? "",
    eposta: formData.get("eposta") ?? "",
    aylikPaket: formData.get("aylikPaket") ?? "",
    pazaryerleri: formData.get("pazaryerleri") ?? "",
    mesaj: formData.get("mesaj") ?? "",
    kaynak: formData.get("kaynak") ?? "",
    kampanya: formData.get("kampanya") ?? "",
  });
  if (!c.success) {
    const ilk = c.error.issues[0];
    return { ok: false, mesaj: ilk?.message ?? "Lütfen alanları kontrol edin." };
  }

  const telefon = telefonNormalize(c.data.telefon);
  if (!telefon) {
    return { ok: false, mesaj: "Geçerli bir cep telefonu girin (05XX XXX XX XX)." };
  }

  const talepId = await teklifYaz({
    telefon,
    ad: bosNull(c.data.ad),
    sirket: bosNull(c.data.sirket),
    eposta: bosNull(c.data.eposta),
    aylikPaket: bosNull(c.data.aylikPaket),
    pazaryerleri: bosNull(c.data.pazaryerleri),
    mesaj: bosNull(c.data.mesaj),
    kaynak: bosNull(c.data.kaynak),
    kampanya: bosNull(c.data.kampanya),
  });

  /*
   * WhatsApp mesajı ÖNCEDEN DOLDURULUR: kişi "merhaba" yazmakla uğraşmasın,
   * biz de hangi talebin kime ait olduğunu ilk mesajdan anlayalım.
   */
  const satirlar = [
    "Merhaba, MarjPanel Paket sitesinden teklif istiyorum.",
    c.data.ad ? `Ad: ${c.data.ad}` : "",
    c.data.sirket ? `Şirket: ${c.data.sirket}` : "",
    c.data.aylikPaket ? `Aylık paket: ${c.data.aylikPaket}` : "",
    c.data.pazaryerleri ? `Pazaryerleri: ${c.data.pazaryerleri}` : "",
    c.data.mesaj ? `Not: ${c.data.mesaj}` : "",
  ].filter(Boolean);

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMARASI}?text=${encodeURIComponent(satirlar.join("\n"))}`;

  revalidatePath("/talepler");
  revalidatePath("/platform");
  return { ok: true, talepId, whatsappUrl, mesaj: "Talebiniz alındı." };
}

/** WhatsApp bağlantısına tıklandığını işaretler (istemciden çağrılır). */
export async function teklifWhatsappIsaretle(id: string): Promise<void> {
  const uuid = z.string().uuid().safeParse(id);
  if (!uuid.success) return;
  await whatsappIsaretle(uuid.data);
  revalidatePath("/talepler");
}

/* ------------------------------------------------------------------ */
/* Panel tarafı — yalnız süper yönetici                                */
/* ------------------------------------------------------------------ */

const YETKISIZ = "Bu işlem için yetkiniz yok.";

export async function teklifDurumKaydet(
  _onceki: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };

  const c = z
    .object({
      id: z.string().uuid(),
      durum: z.enum(teklifDurumuEnum.enumValues),
      notlar: z.string().trim().max(AZAMI_METIN).optional().default(""),
    })
    .safeParse({
      id: formData.get("id") ?? "",
      durum: formData.get("durum") ?? "yeni",
      notlar: formData.get("notlar") ?? "",
    });
  if (!c.success) return { ok: false, mesaj: "Form geçersiz." };

  await durumGuncelle(c.data.id, c.data.durum, bosNull(c.data.notlar));
  revalidatePath("/talepler");
  return { ok: true, mesaj: "Kaydedildi." };
}

export async function teklifSil(id: string): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const ok = await sil(id);
  revalidatePath("/talepler");
  return ok ? { ok: true, mesaj: "Silindi." } : { ok: false, mesaj: "Bulunamadı." };
}
