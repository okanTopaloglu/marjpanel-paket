"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import {
  HIZ_SINIRI_MESAJI,
  girisDenemesiSay,
  girisSayaciTemizle,
  istemciIp,
} from "@/lib/guvenlik/hiz-siniri";
import { telefonNormalize } from "@/lib/format/telefon";
import { guvenliGeriYolu } from "@/lib/auth/geri-yolu";

/** Tüm form eylemlerinin ortak dönüş şekli (`useActionState` durumu). */
export interface EylemDurumu {
  ok: boolean;
  mesaj?: string;
  /** Alan adı → hata mesajı; formda ilgili alanın altında gösterilir. */
  alanlar?: Record<string, string>;
}

const girisSemasi = z.object({
  telefon: z.string().trim().min(1, "Telefon gerekli."),
  parola: z.string().min(1, "Parola gerekli."),
  geri: z.string().optional(),
});

const HATALI_GIRIS_MESAJI = "Telefon veya parola hatalı.";

/**
 * GİRİŞ EYLEMİ (`useActionState` ile kullanılır).
 *
 * MESAJ TEK TİPTİR: telefon kayıtlı değil, hesap pasif, hesap kilitli ya da
 * parola yanlış — hepsi aynı cümleyi görür. Hangi telefonun sistemde kayıtlı
 * olduğu dışarıdan okunamamalı (hesap sayımı saldırısı).
 *
 * İKİ KATMANLI KABA KUVVET KORUMASI:
 *   1. Burada IP başına 10 deneme / 15 dk (argon2 hiç çalışmadan reddeder).
 *   2. auth.ts + repo'da hesap başına 5 deneme → 15 dk kilit.
 */
export async function girisYap(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const ip = istemciIp(await headers());
  if (girisDenemesiSay(ip).engellendi) {
    return { ok: false, mesaj: HIZ_SINIRI_MESAJI };
  }

  const cozum = girisSemasi.safeParse({
    telefon: formData.get("telefon"),
    parola: formData.get("parola"),
    geri: formData.get("geri") ?? undefined,
  });
  if (!cozum.success) {
    return { ok: false, mesaj: HATALI_GIRIS_MESAJI };
  }

  // Maskeli girdiyi ("0532 123 45 67") kanonik biçime çevir. Geçersizse de
  // aynı mesaj döner: "böyle bir telefon yok" ile "parola yanlış" ayrılmaz.
  const telefon = telefonNormalize(cozum.data.telefon);
  if (!telefon) return { ok: false, mesaj: HATALI_GIRIS_MESAJI };

  try {
    // `redirect: false` — yönlendirmeyi biz yapıyoruz ki `geri` parametresi
    // doğrulanmış hâliyle kullanılsın (Auth.js'in callbackUrl'ine güvenmeyiz).
    await signIn("credentials", { telefon, parola: cozum.data.parola, redirect: false });
  } catch (hata) {
    if (hata instanceof AuthError) {
      return { ok: false, mesaj: HATALI_GIRIS_MESAJI };
    }
    throw hata;
  }

  // Doğru parolayı giren kullanıcı önceki hatalı denemeler yüzünden
  // bekletilmesin.
  girisSayaciTemizle(ip);

  // `redirect` NEXT_REDIRECT fırlatır; try bloğunun DIŞINDA olmalı ki
  // yukarıdaki catch onu bir giriş hatası sanmasın.
  redirect(guvenliGeriYolu(cozum.data.geri) ?? "/");
}

export async function cikisYap(): Promise<void> {
  await signOut({ redirectTo: "/giris" });
}
