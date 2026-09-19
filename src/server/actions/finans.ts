"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { superKapsami } from "@/lib/auth/yetki";
import { donemMi, kesimHesapla, type DigerKalem } from "@/lib/finans/hesap";
import {
  donemPaketSayisi,
  gecerliTarife,
  kesimDurumu,
  kesimGetir,
  kesimSil,
  kesimTaslakYaz,
  odemeEkle,
  tarifeKaydet,
  tarifeSil,
  tarifeTanimi,
} from "@/lib/db/repos/finans";
import type { EylemDurumu } from "./auth";

/**
 * FİNANS EYLEMLERİ — yalnız super_admin. Kiracı yöneticisi Hesabım'ı OKUR
 * (sayfa kapısı), buradaki hiçbir eylemi çağıramaz.
 */
const YETKISIZ = "Bu işlem için yetkiniz yok.";
const YOLLAR = ["/hesap-kesimi", "/hesabim", "/"];
function tazele() {
  for (const y of YOLLAR) revalidatePath(y);
}

function json<T>(ham: FormDataEntryValue | null, varsayilan: T): T {
  try {
    const v = JSON.parse(String(ham ?? "")) as T;
    return v ?? varsayilan;
  } catch {
    return varsayilan;
  }
}

/* ---------------------------- Tarife ---------------------------- */

const tarifeSemasi = z.object({
  sirketId: z.string().uuid("Şirket seçin."),
  gecerlilikBaslangic: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  kademeTipi: z.enum(["toplam", "dilimli"]),
  kdvOrani: z.coerce.number().min(0).max(100),
  not: z.string().trim().max(300).optional().default(""),
});

export async function tarifeKaydetForm(_o: EylemDurumu | undefined, formData: FormData): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };

  const c = tarifeSemasi.safeParse({
    sirketId: formData.get("sirketId") ?? "",
    gecerlilikBaslangic: formData.get("gecerlilikBaslangic") ?? "",
    kademeTipi: formData.get("kademeTipi") ?? "toplam",
    kdvOrani: formData.get("kdvOrani") ?? "20",
    not: formData.get("not") ?? "",
  });
  if (!c.success) return { ok: false, mesaj: c.error.issues[0]?.message ?? "Form geçersiz." };

  const kademeler = json<unknown[]>(formData.get("kademeler"), []);
  const ekHizmetler = json<unknown[]>(formData.get("ekHizmetler"), []);
  if (!Array.isArray(kademeler) || kademeler.length === 0) {
    return { ok: false, mesaj: "En az bir kademe girin (sınırsız kademe için üst sınırı boş bırakın)." };
  }

  await tarifeKaydet({ ...c.data, not: c.data.not || null, kademeler, ekHizmetler, kaydedenAd: k.ad });
  tazele();
  return { ok: true, mesaj: "Tarife kaydedildi." };
}

export async function tarifeSilEylemi(id: string): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const s = await tarifeSil(id);
  tazele();
  return s ? { ok: true, mesaj: "Tarife silindi." } : { ok: false, mesaj: "Tarife bulunamadı." };
}

/* --------------------------- Kesim ----------------------------- */

const taslakSemasi = z.object({
  sirketId: z.string().uuid("Şirket seçin."),
  donem: z.string().refine(donemMi, "Dönem geçersiz."),
  not: z.string().trim().max(500).optional().default(""),
});

/** Taslak oluşturur/yeniler: dönem paket sayısı + geçerli tarife + ek hizmet adetleri + diğer kalemler. */
export async function kesimTaslakOlustur(_o: EylemDurumu | undefined, formData: FormData): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };

  const c = taslakSemasi.safeParse({
    sirketId: formData.get("sirketId") ?? "",
    donem: formData.get("donem") ?? "",
    not: formData.get("not") ?? "",
  });
  if (!c.success) return { ok: false, mesaj: c.error.issues[0]?.message ?? "Form geçersiz." };

  const tarife = await gecerliTarife(c.data.sirketId, `${c.data.donem}-01`);
  if (!tarife) return { ok: false, mesaj: "Bu şirket için dönem başında geçerli bir tarife yok. Önce tarife tanımlayın." };

  const ekHam = json<Record<string, unknown>>(formData.get("ekHizmetAdetleri"), {});
  const ekAdetleri: Record<string, number> = {};
  for (const [kod, v] of Object.entries(ekHam ?? {})) ekAdetleri[kod] = Number(v) || 0;
  const diger = json<DigerKalem[]>(formData.get("digerKalemler"), []).map((d) => ({
    aciklama: String(d.aciklama ?? ""),
    adet: Number(d.adet),
    birimFiyat: Number(d.birimFiyat),
  }));

  const paketSayisi = await donemPaketSayisi(c.data.sirketId, c.data.donem);
  const sonuc = kesimHesapla(paketSayisi, tarifeTanimi(tarife), ekAdetleri, diger);

  try {
    const { yeniden } = await kesimTaslakYaz({
      sirketId: c.data.sirketId,
      donem: c.data.donem,
      paketSayisi,
      sonuc,
      not: c.data.not || null,
      kaydedenAd: k.ad,
    });
    tazele();
    return { ok: true, mesaj: yeniden ? "Taslak yeniden hesaplandı." : "Taslak oluşturuldu." };
  } catch (hata) {
    return { ok: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
  }
}

const kesSemasi = z.object({
  id: z.string().uuid(),
  faturaNo: z.string().trim().max(60).optional().default(""),
  vadeTarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vade tarihi geçersiz."),
});

/** Taslağı keser: fatura no + vade; tutarlar artık değişmez. */
export async function kesimKes(_o: EylemDurumu | undefined, formData: FormData): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const c = kesSemasi.safeParse({
    id: formData.get("id") ?? "",
    faturaNo: formData.get("faturaNo") ?? "",
    vadeTarihi: formData.get("vadeTarihi") ?? "",
  });
  if (!c.success) return { ok: false, mesaj: c.error.issues[0]?.message ?? "Form geçersiz." };
  const kesim = await kesimGetir(c.data.id);
  if (!kesim) return { ok: false, mesaj: "Kesim bulunamadı." };
  if (kesim.durum !== "taslak") return { ok: false, mesaj: "Yalnız taslak kesilebilir." };
  await kesimDurumu(c.data.id, { durum: "kesildi", faturaNo: c.data.faturaNo || null, vadeTarihi: c.data.vadeTarihi });
  tazele();
  return { ok: true, mesaj: "Hesap kesildi." };
}

export async function kesimIptal(id: string): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const kesim = await kesimGetir(id);
  if (!kesim) return { ok: false, mesaj: "Kesim bulunamadı." };
  if (kesim.durum === "odendi") return { ok: false, mesaj: "Ödenmiş kesim iptal edilemez." };
  if (kesim.durum === "taslak") {
    await kesimSil(id);
    tazele();
    return { ok: true, mesaj: "Taslak silindi." };
  }
  await kesimDurumu(id, { durum: "iptal" });
  tazele();
  return { ok: true, mesaj: "Kesim iptal edildi." };
}

/* --------------------------- Ödeme ----------------------------- */

const odemeSemasi = z.object({
  sirketId: z.string().uuid("Şirket seçin."),
  kesimId: z.string().uuid().optional().or(z.literal("")),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  tutar: z.coerce.number().positive("Tutar sıfırdan büyük olmalı."),
  yontem: z.enum(["havale", "nakit", "kredi_karti", "diger"]),
  not: z.string().trim().max(300).optional().default(""),
});

export async function odemeKaydet(_o: EylemDurumu | undefined, formData: FormData): Promise<EylemDurumu> {
  const k = await superKapsami();
  if (!k) return { ok: false, mesaj: YETKISIZ };
  const c = odemeSemasi.safeParse({
    sirketId: formData.get("sirketId") ?? "",
    kesimId: formData.get("kesimId") ?? "",
    tarih: formData.get("tarih") ?? "",
    tutar: String(formData.get("tutar") ?? "").replace(",", "."),
    yontem: formData.get("yontem") ?? "havale",
    not: formData.get("not") ?? "",
  });
  if (!c.success) return { ok: false, mesaj: c.error.issues[0]?.message ?? "Form geçersiz." };
  await odemeEkle({
    sirketId: c.data.sirketId,
    kesimId: c.data.kesimId || null,
    tarih: c.data.tarih,
    tutar: Math.round(c.data.tutar * 100) / 100,
    yontem: c.data.yontem,
    not: c.data.not || null,
    kaydedenAd: k.ad,
  });
  tazele();
  return { ok: true, mesaj: "Ödeme kaydedildi." };
}
