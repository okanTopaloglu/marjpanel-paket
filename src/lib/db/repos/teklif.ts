import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { teklifTalepleri, type TeklifDurumu, type TeklifTalebi } from "@/lib/db/schema";

/**
 * TEKLİF TALEPLERİ REPOSU — tanıtım sayfası formundan gelen kayıtlar.
 *
 * Platform düzeyi: talepler henüz bir şirkete ait değil, aday müşteridir.
 */

export interface TeklifGirdisi {
  telefon: string;
  ad: string | null;
  sirket: string | null;
  eposta: string | null;
  aylikPaket: string | null;
  pazaryerleri: string | null;
  mesaj: string | null;
  kaynak: string | null;
  kampanya: string | null;
}

/**
 * Talebi yazar ve kimliğini döner.
 *
 * AYNI KİŞİ TEKRAR DOLDURURSA yeni satır açılır, üzerine yazılmaz: kişi
 * fikrini değiştirip farklı bilgi vermiş olabilir ve ilk talebi silmek
 * geçmişi kaybettirir. Panelde aynı telefon peş peşe görünür, bu bilgidir.
 */
export async function teklifYaz(g: TeklifGirdisi): Promise<string> {
  const [satir] = await db.insert(teklifTalepleri).values(g).returning({ id: teklifTalepleri.id });
  if (!satir) throw new Error("Teklif talebi kaydedilemedi.");
  return satir.id;
}

/** WhatsApp'a gerçekten gidildiğini işaretler (form gönderiminden sonra). */
export async function whatsappIsaretle(id: string): Promise<void> {
  await db
    .update(teklifTalepleri)
    .set({ whatsappAcildi: true, updatedAt: new Date() })
    .where(eq(teklifTalepleri.id, id));
}

export async function durumGuncelle(id: string, durum: TeklifDurumu, notlar: string | null): Promise<void> {
  await db
    .update(teklifTalepleri)
    .set({ durum, notlar, updatedAt: new Date() })
    .where(eq(teklifTalepleri.id, id));
}

export async function sil(id: string): Promise<boolean> {
  const s = await db.delete(teklifTalepleri).where(eq(teklifTalepleri.id, id)).returning({ id: teklifTalepleri.id });
  return s.length > 0;
}

export async function listele(limit = 200): Promise<TeklifTalebi[]> {
  return db.select().from(teklifTalepleri).orderBy(desc(teklifTalepleri.createdAt)).limit(limit);
}

export interface TeklifOzeti {
  toplam: number;
  yeni: number;
  whatsappaGiden: number;
  /** Formu doldurup WhatsApp'a GİTMEYENLER - asıl takip edilecek grup. */
  whatsappsiz: number;
  sonYediGun: number;
}

export async function teklifOzeti(): Promise<TeklifOzeti> {
  const [s] = await db
    .select({
      toplam: sql<number>`count(*)::int`,
      yeni: sql<number>`count(*) filter (where ${teklifTalepleri.durum} = 'yeni')::int`,
      whatsappaGiden: sql<number>`count(*) filter (where ${teklifTalepleri.whatsappAcildi})::int`,
      whatsappsiz: sql<number>`count(*) filter (where not ${teklifTalepleri.whatsappAcildi})::int`,
      sonYediGun: sql<number>`count(*) filter (where ${teklifTalepleri.createdAt} > now() - interval '7 days')::int`,
    })
    .from(teklifTalepleri);

  return {
    toplam: s?.toplam ?? 0,
    yeni: s?.yeni ?? 0,
    whatsappaGiden: s?.whatsappaGiden ?? 0,
    whatsappsiz: s?.whatsappsiz ?? 0,
    sonYediGun: s?.sonYediGun ?? 0,
  };
}
