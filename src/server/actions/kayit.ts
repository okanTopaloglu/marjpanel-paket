"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { signIn } from "@/auth";
import {
  KAYIT_HIZ_SINIRI_MESAJI,
  istemciIp,
  kayitDenemesiSay,
} from "@/lib/guvenlik/hiz-siniri";
import { telefonNormalize } from "@/lib/format/telefon";
import { CakismaHatasi, sirketVeYoneticiOlustur } from "@/lib/db/repos/sirketler";
import type { EylemDurumu } from "./auth";

const KAYIT_KAPALI_MESAJI =
  "Kayıt şu anda kapalı. Hesap açılması için lütfen yöneticinizle görüşün.";

const semasi = z
  .object({
    sirketAd: z
      .string()
      .trim()
      .min(2, "Şirket adı en az 2 karakter olmalı.")
      .max(80, "Şirket adı en fazla 80 karakter olabilir."),
    ad: z
      .string()
      .trim()
      .min(2, "Ad en az 2 karakter olmalı.")
      .max(60, "Ad en fazla 60 karakter olabilir."),
    telefon: z.string().trim().min(1, "Telefon gerekli."),
    parola: z.string().min(6, "Parola en az 6 karakter olmalı."),
    parolaTekrar: z.string().min(1, "Parolayı tekrar girin."),
  })
  .refine((d) => d.parola === d.parolaTekrar, {
    path: ["parolaTekrar"],
    message: "Parolalar aynı değil.",
  });

/** Zod hatalarını forma alan bazlı dağıt. */
function alanHatalari(hata: z.ZodError): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path[0];
    if (typeof alan === "string" && !cikti[alan]) cikti[alan] = sorun.message;
  }
  return cikti;
}

/**
 * ŞİRKET KAYDI — kendi kendine kayıt akışı.
 * ---------------------------------------------------------------------------
 * KAPI SUNUCU TARAFINDADIR: `KAYIT_ACIK !== "1"` ise bu eylem hiçbir şey
 * yapmaz. `/kayit` sayfası da formu hiç çizmez, ama bu TEK BAŞINA yeterli
 * DEĞİLDİR — eylem doğrudan çağrılabilir (devtools, eski sekme, betik). Bayrak
 * kontrolü en başta: hız sınırı, doğrulama, DB — hiçbiri kapalıyken çalışmaz.
 *
 * İlk kullanıcı kendi şirketinin `admin`idir (repo böyle yazar); `super_admin`
 * bu akışla ASLA üretilmez.
 */
export async function sirketKaydet(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  if (process.env.KAYIT_ACIK !== "1") {
    return { ok: false, mesaj: KAYIT_KAPALI_MESAJI };
  }

  const ip = istemciIp(await headers());
  if (kayitDenemesiSay(ip).engellendi) {
    return { ok: false, mesaj: KAYIT_HIZ_SINIRI_MESAJI };
  }

  const cozum = semasi.safeParse({
    sirketAd: formData.get("sirketAd"),
    ad: formData.get("ad"),
    telefon: formData.get("telefon"),
    parola: formData.get("parola"),
    parolaTekrar: formData.get("parolaTekrar"),
  });
  if (!cozum.success) {
    return {
      ok: false,
      mesaj: "Lütfen işaretli alanları düzeltin.",
      alanlar: alanHatalari(cozum.error),
    };
  }

  // Kayıt ve giriş AYNI normalizasyondan geçmeli; yoksa kullanıcı kaydolduğu
  // numarayla giriş yapamaz.
  const telefon = telefonNormalize(cozum.data.telefon);
  if (!telefon) {
    return {
      ok: false,
      mesaj: "Lütfen işaretli alanları düzeltin.",
      alanlar: { telefon: "Geçerli bir cep telefonu girin (05XX XXX XX XX)." },
    };
  }

  const parolaHash = await hash(cozum.data.parola);

  try {
    // Şirket + ilk yönetici TEK transaction; biri olmazsa hiçbiri olmaz.
    await sirketVeYoneticiOlustur({
      sirketAd: cozum.data.sirketAd,
      ad: cozum.data.ad,
      telefon,
      parolaHash,
    });
  } catch (hata) {
    if (hata instanceof CakismaHatasi) {
      if (hata.alan === "telefon") {
        return {
          ok: false,
          mesaj: "Lütfen işaretli alanları düzeltin.",
          alanlar: { telefon: "Bu telefon numarası zaten kayıtlı. Giriş yapmayı deneyin." },
        };
      }
      return {
        ok: false,
        mesaj: "Lütfen işaretli alanları düzeltin.",
        alanlar: { sirketAd: "Bu şirket adı zaten kullanılıyor." },
      };
    }
    throw hata;
  }

  try {
    // OTOMATİK GİRİŞ: `girisYap` ile aynı desen (redirect: false + kendi
    // yönlendirmemiz).
    await signIn("credentials", { telefon, parola: cozum.data.parola, redirect: false });
  } catch (hata) {
    if (hata instanceof AuthError) {
      // Hesap AÇILDI ama otomatik giriş reddedildi (teorik olarak olmamalı).
      // Kullanıcıyı boşa döndürmek yerine açık mesaj: elle giriş her zaman çalışır.
      return {
        ok: true,
        mesaj: "Hesabınız oluşturuldu. Giriş sayfasından oturum açabilirsiniz.",
      };
    }
    throw hata;
  }

  // NEXT_REDIRECT fırlatır; try bloğunun DIŞINDA olmalı.
  redirect("/");
}
