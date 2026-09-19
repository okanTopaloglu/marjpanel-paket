"use server";

import { revalidatePath } from "next/cache";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { adminKapsami } from "@/lib/auth/yetki";
import { telefonNormalize } from "@/lib/format/telefon";
import { alanHatalari } from "@/lib/form/alan-hatalari";
import {
  KullaniciIslemHatasi,
  guncelle,
  olustur,
  sil,
  sirketOkutmaModu,
} from "@/lib/db/repos/kullanicilar";
import { CakismaHatasi } from "@/lib/db/repos/sirketler";
import type { OkutmaModu } from "@/lib/db/schema";
import type { EylemDurumu } from "./auth";

/**
 * KULLANICI YÖNETİMİ — server action'lar.
 * ---------------------------------------------------------------------------
 * Kapı `adminKapsami()`: admin ya da super_admin. Kiracı izolasyonu ve iş
 * kuralları (son admin, kendi rolünü değiştirememe, `super_admin` rolünün
 * yalnız super_admin tarafından atanabilmesi) REPO katmanındadır
 * (`lib/db/repos/kullanicilar.ts`) — burada yalnız form ayrıştırma ve
 * hata mesajı çevirisi var.
 */

const YETKISIZ_MESAJI = "Bu işlem için yetkiniz yok.";
const DUZELT_MESAJI = "Lütfen işaretli alanları düzeltin.";

const rolSemasi = z.enum(["admin", "calisan", "super_admin"]);
const okutmaModuSemasi = z.enum(["hizli", "rehberli", "toplama"]);

/** Kullanıcı iş kuralı hatasını forma çevirir; diğerlerini yeniden fırlatır. */
function kullaniciHatasiniCevir(hata: unknown): EylemDurumu {
  if (hata instanceof KullaniciIslemHatasi) {
    return { ok: false, mesaj: hata.message };
  }
  if (hata instanceof CakismaHatasi && hata.alan === "telefon") {
    return {
      ok: false,
      mesaj: DUZELT_MESAJI,
      alanlar: { telefon: "Bu telefon numarası zaten kayıtlı." },
    };
  }
  throw hata;
}

const ekleSemasi = z.object({
  ad: z
    .string()
    .trim()
    .min(2, "Ad en az 2 karakter olmalı.")
    .max(60, "Ad en fazla 60 karakter olabilir."),
  telefon: z.string().trim().min(1, "Telefon gerekli."),
  parola: z.string().min(6, "Parola en az 6 karakter olmalı."),
  rol: rolSemasi,
  okutmaModu: z.union([okutmaModuSemasi, z.literal("")]),
  sirketId: z.union([z.string().uuid(), z.literal("")]),
});

/** Yeni kullanıcı ekler (admin: kendi şirketi; super_admin: seçtiği şirket). */
export async function kullaniciEkle(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = ekleSemasi.safeParse({
    ad: formData.get("ad"),
    telefon: formData.get("telefon"),
    parola: formData.get("parola"),
    rol: formData.get("rol"),
    okutmaModu: formData.get("okutmaModu") ?? "",
    sirketId: formData.get("sirketId") ?? "",
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
  }

  if (cozum.data.rol === "super_admin" && kapsam.rol !== "super_admin") {
    return {
      ok: false,
      mesaj: DUZELT_MESAJI,
      alanlar: { rol: "Bu rolü yalnızca platform yöneticisi atayabilir." },
    };
  }

  const telefon = telefonNormalize(cozum.data.telefon);
  if (!telefon) {
    return {
      ok: false,
      mesaj: DUZELT_MESAJI,
      alanlar: { telefon: "Geçerli bir cep telefonu girin (05XX XXX XX XX)." },
    };
  }

  const parolaHash = await hash(cozum.data.parola);

  try {
    await olustur(kapsam, {
      ad: cozum.data.ad,
      telefon,
      parolaHash,
      rol: cozum.data.rol,
      okutmaModu: cozum.data.okutmaModu === "" ? null : cozum.data.okutmaModu,
      sirketId: cozum.data.sirketId || undefined,
    });
  } catch (hata) {
    return kullaniciHatasiniCevir(hata);
  }

  revalidatePath("/kullanicilar");
  return { ok: true, mesaj: "Kullanıcı eklendi." };
}

const guncelleSemasi = z.object({
  id: z.string().uuid(),
  ad: z
    .string()
    .trim()
    .min(2, "Ad en az 2 karakter olmalı.")
    .max(60, "Ad en fazla 60 karakter olabilir."),
  telefon: z.string().trim().min(1, "Telefon gerekli."),
  parola: z.union([z.string().min(6, "Parola en az 6 karakter olmalı."), z.literal("")]),
  rol: rolSemasi,
  okutmaModu: z.union([okutmaModuSemasi, z.literal("")]),
});

/** Var olan kullanıcıyı günceller (parola boşsa değiştirilmez). */
export async function kullaniciGuncelle(
  _oncekiDurum: EylemDurumu | undefined,
  formData: FormData,
): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = guncelleSemasi.safeParse({
    id: formData.get("id"),
    ad: formData.get("ad"),
    telefon: formData.get("telefon"),
    parola: formData.get("parola") ?? "",
    rol: formData.get("rol"),
    okutmaModu: formData.get("okutmaModu") ?? "",
  });
  if (!cozum.success) {
    return { ok: false, mesaj: DUZELT_MESAJI, alanlar: alanHatalari(cozum.error) };
  }

  if (cozum.data.rol === "super_admin" && kapsam.rol !== "super_admin") {
    return {
      ok: false,
      mesaj: DUZELT_MESAJI,
      alanlar: { rol: "Bu rolü yalnızca platform yöneticisi atayabilir." },
    };
  }

  const telefon = telefonNormalize(cozum.data.telefon);
  if (!telefon) {
    return {
      ok: false,
      mesaj: DUZELT_MESAJI,
      alanlar: { telefon: "Geçerli bir cep telefonu girin (05XX XXX XX XX)." },
    };
  }

  const parolaHash = cozum.data.parola ? await hash(cozum.data.parola) : undefined;

  try {
    await guncelle(kapsam, cozum.data.id, {
      ad: cozum.data.ad,
      telefon,
      rol: cozum.data.rol,
      okutmaModu: cozum.data.okutmaModu === "" ? null : cozum.data.okutmaModu,
      parolaHash,
    });
  } catch (hata) {
    return kullaniciHatasiniCevir(hata);
  }

  revalidatePath("/kullanicilar");
  return { ok: true, mesaj: "Kullanıcı güncellendi." };
}

/** Kullanıcıyı siler. Onay diyaloğundan doğrudan çağrılır (form gerekmez). */
export async function kullaniciSil(id: string): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  try {
    await sil(kapsam, id);
  } catch (hata) {
    return kullaniciHatasiniCevir(hata);
  }

  revalidatePath("/kullanicilar");
  return { ok: true, mesaj: "Kullanıcı silindi." };
}

/** Kullanıcıyı aktifleştirir/pasifleştirir (satır menüsünden doğrudan çağrılır). */
export async function kullaniciAktiflik(id: string, aktif: boolean): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  try {
    await guncelle(kapsam, id, { aktif });
  } catch (hata) {
    return kullaniciHatasiniCevir(hata);
  }

  revalidatePath("/kullanicilar");
  return { ok: true, mesaj: aktif ? "Kullanıcı aktifleştirildi." : "Kullanıcı pasifleştirildi." };
}

/** Şirketin varsayılan okutma modunu değiştirir. */
export async function sirketOkutmaModuKaydet(mod: OkutmaModu): Promise<EylemDurumu> {
  const kapsam = await adminKapsami();
  if (!kapsam) return { ok: false, mesaj: YETKISIZ_MESAJI };

  const cozum = okutmaModuSemasi.safeParse(mod);
  if (!cozum.success) return { ok: false, mesaj: "Geçersiz okutma modu." };

  await sirketOkutmaModu(kapsam, cozum.data);
  revalidatePath("/kullanicilar");
  return { ok: true, mesaj: "Varsayılan okutma modu güncellendi." };
}
