"use server";

import { revalidatePath } from "next/cache";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { panelKapsami } from "@/lib/auth/yetki";
import { alanHatalari } from "@/lib/form/alan-hatalari";
import { dosyaKaydet, dosyaSil } from "@/lib/depo/dosya";
import { idIleGetir, profilGorseliAyarla, profilGuncelle as profilGuncelleRepo } from "@/lib/db/repos/kullanicilar";
import type { EylemDurumu } from "./auth";

/**
 * KENDİ PROFİLİ — server action'lar. Kapı `panelKapsami()`: girişli HERHANGİ
 * bir kullanıcı (çalışan dâhil) kendi adını/parolasını/görselini değiştirir.
 * `revalidatePath('/', 'layout')` KOŞULSUZ — kabuktaki topbar avatarı ve adı
 * her sayfada göründüğü için tek bir alt yol yeniden doğrulaması yetmez.
 */

const YETKISIZ_MESAJI = "Oturum bulunamadı.";
const DUZELT_MESAJI = "Lütfen işaretli alanları düzeltin.";

const profilSemasi = z
  .object({
    ad: z
      .string()
      .trim()
      .min(2, "Ad en az 2 karakter olmalı.")
      .max(60, "Ad en fazla 60 karakter olabilir."),
    mevcutParola: z.string().optional().default(""),
    yeniParola: z.string().optional().default(""),
    yeniParolaTekrar: z.string().optional().default(""),
  })
  .refine((d) => d.yeniParola === "" || d.yeniParola.length >= 6, {
    path: ["yeniParola"],
    message: "Yeni parola en az 6 karakter olmalı.",
  })
  .refine((d) => d.yeniParola === d.yeniParolaTekrar, {
    path: ["yeniParolaTekrar"],
    message: "Parolalar aynı değil.",
  })
  .refine((d) => d.yeniParola === "" || d.mevcutParola !== "", {
    path: ["mevcutParola"],
    message: "Mevcut parolanızı girin.",
  });

/** Ad değiştirir; `yeniParola` doluysa `mevcutParola` doğrulanıp parola da değişir. */
export async function profilGuncelle(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = profilSemasi.safeParse({
    ad: formData.get("ad"),
    mevcutParola: formData.get("mevcutParola") ?? "",
    yeniParola: formData.get("yeniParola") ?? "",
    yeniParolaTekrar: formData.get("yeniParolaTekrar") ?? "",
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
  }

  let parolaHash: string | undefined;
  if (cozum.data.yeniParola !== "") {
    const kullanici = await idIleGetir(kapsam.kullaniciId);
    if (!kullanici) return { ok: false, mesaj: "Kullanıcı bulunamadı." };
    const dogru = await verify(kullanici.parolaHash, cozum.data.mevcutParola);
    if (!dogru) {
      return {
        ok: false,
        mesaj: DUZELT_MESAJI,
        alanlar: { mevcutParola: "Mevcut parola yanlış." },
      };
    }
    parolaHash = await hash(cozum.data.yeniParola);
  }

  await profilGuncelleRepo(kapsam.kullaniciId, { ad: cozum.data.ad, parolaHash });
  revalidatePath("/", "layout");
  return { ok: true, mesaj: "Profil güncellendi." };
}

const IZINLI_TURLER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const AZAMI_BOYUT = 2 * 1024 * 1024;

/** Profil görseli yükler (`gorsel` alanı, istemcide zaten sıkıştırılmış). */
export async function profilGorseliYukle(formData: FormData): Promise<EylemDurumu> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const dosya = formData.get("gorsel");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { ok: false, mesaj: "Lütfen bir görsel seçin." };
  }
  const uzanti = IZINLI_TURLER[dosya.type];
  if (!uzanti) {
    return { ok: false, mesaj: "Yalnız JPEG, PNG ya da WEBP görseller kabul edilir." };
  }
  if (dosya.size > AZAMI_BOYUT) {
    return { ok: false, mesaj: "Görsel en fazla 2 MB olabilir." };
  }

  const arabellek = Buffer.from(await dosya.arrayBuffer());
  const dosyaAdi = await dosyaKaydet(arabellek, uzanti);

  const eskiDosya = await profilGorseliAyarla(kapsam.kullaniciId, dosyaAdi);
  if (eskiDosya) await dosyaSil(eskiDosya);

  revalidatePath("/", "layout");
  return { ok: true, mesaj: "Profil görseli güncellendi." };
}

/** Profil görselini kaldırır (baş harfe döner). */
export async function profilGorseliSil(): Promise<EylemDurumu> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const eskiDosya = await profilGorseliAyarla(kapsam.kullaniciId, null);
  if (eskiDosya) await dosyaSil(eskiDosya);

  revalidatePath("/", "layout");
  return { ok: true, mesaj: "Profil görseli kaldırıldı." };
}
