import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  senkronIsleri,
  type SenkronIsi,
  type SenkronTuru,
  type SenkronDurumu,
} from "@/lib/db/schema";
import type { Kapsam } from "@/lib/auth/kapsam";

/**
 * SENKRON İŞ KUYRUĞU — süreçler arası kilit VERİTABANINDADIR.
 *
 * PartnerSys kuyruğu süreç belleğinde tutuyordu (`let running = false`). Tek
 * Node süreci varken çalışır; iki örnek (ölçekleme, dağıtım sırasında eski ve
 * yeni konteynerin bir arada koşması) aynı anda senkrona girer ve Trendyol
 * hemen 429 verirdi. Burada kilit şemadaki KISMİ TEKİL İNDEKStir:
 *
 *   unique (tur) where durum = 'calisiyor'
 *
 * "Çalışıyor" satırını AÇABİLEN tek süreç işi yürütür; diğerleri 23505 alır ve
 * sessizce çekilir. Kilidin sahibi süreç ölürse satır 'calisiyor'da kalır -
 * `bayatlariSerbestBirak` beş dakikadan eski satırları 'hata'ya çevirir, yoksa
 * kuyruk kalıcı olarak kilitlenirdi.
 */

/** 'calisiyor' satırı bu süreden eskiyse sahibi öldü sayılır. */
export const BAYAT_DK = 5;

/** İlerleme jsonb'sinin şekli (arayüz ilerleme çubuğunu bundan çizer). */
export interface SenkronIlerlemesi {
  adim: "siparis" | "urun" | "bekliyor" | "bitti";
  /** Sırası gelen entegrasyonun görünen adı. */
  entegrasyon?: string | null;
  /** Kaçıncı tarih penceresi / toplam pencere. */
  pencere?: number;
  toplamPencere?: number;
  /** 0 tabanlı sayfa / bilinen toplam sayfa. */
  sayfa?: number;
  toplamSayfa?: number | null;
  /** API'den gelen kayıt sayısı. */
  apiden?: number;
  /** Veritabanına yazılan kayıt sayısı. */
  yazilan?: number;
  /** Entegrasyon adı → o entegrasyonda yazılan kayıt. */
  tamamlanan?: Record<string, number>;
}

export type SenkronTetik = "oto" | "manuel" | "cron";

function tekillikIhlaliMi(hata: unknown): boolean {
  let h: unknown = hata;
  for (let i = 0; i < 5 && h; i++) {
    const o = h as { code?: unknown; cause?: unknown };
    if (o.code === "23505") return true;
    h = o.cause;
  }
  return false;
}

/**
 * Sahipsiz kalmış 'calisiyor' satırlarını serbest bırakır. Her tik'in İLK
 * adımıdır: kilit bir kez sızarsa senkron bir daha hiç çalışmazdı.
 */
export async function bayatlariSerbestBirak(): Promise<number> {
  const satirlar = await db
    .update(senkronIsleri)
    .set({
      durum: "hata",
      bitis: new Date(),
      mesaj: `İş ${BAYAT_DK} dakikadır ilerlemiyor; süreç düşmüş olabilir.`,
    })
    .where(
      and(
        eq(senkronIsleri.durum, "calisiyor"),
        sql`coalesce(${senkronIsleri.baslangic}, ${senkronIsleri.createdAt}) < now() - interval '${sql.raw(String(BAYAT_DK))} minutes'`,
      ),
    )
    .returning({ id: senkronIsleri.id });
  if (satirlar.length) {
    console.warn(`[senkron] ${satirlar.length} bayat iş serbest bırakıldı.`);
  }
  return satirlar.length;
}

/**
 * Kuyruktan bir iş ALIR (atomik).
 *
 * `FOR UPDATE SKIP LOCKED` ile iki süreç aynı satırı almaya çalışmaz; kısmi
 * tekil indeks de aynı türden ikinci bir 'calisiyor' satırını reddeder. İkisi
 * birlikte: "tek iş, tek sahip".
 */
export async function bekleyenAl(tur: SenkronTuru): Promise<SenkronIsi | null> {
  try {
    /*
     * `returning *` YETMEZ: ham SQL sütunları VERİTABANI ADIYLA (snake_case)
     * döndürür, `SenkronIsi` ise camelCase alanlar bekler. Tip uyuşmuş
     * görünürken `is.entegrasyonId` çalışma zamanında `undefined` olurdu -
     * manuel iş açan entegrasyon sessizce kaybolurdu. Sütunlar bu yüzden
     * TEK TEK takma adlandırılır.
     */
    const satirlar = await db.execute<SenkronIsi>(sql`
      update senkron_isleri
         set durum = 'calisiyor', baslangic = now()
       where id = (
         select id from senkron_isleri
          where durum = 'bekliyor' and tur = ${tur}
          order by created_at
          limit 1
          for update skip locked
       )
      returning
        id,
        tur,
        tetik,
        sirket_id      as "sirketId",
        entegrasyon_id as "entegrasyonId",
        durum,
        baslangic,
        bitis,
        ilerleme,
        mesaj,
        hatalar,
        created_at     as "createdAt"
    `);
    return satirlar[0] ?? null;
  } catch (hata) {
    // Aynı türden bir iş zaten çalışıyor (kısmi tekil indeks) — sıra ona ait.
    if (tekillikIhlaliMi(hata)) return null;
    throw hata;
  }
}

/**
 * Doğrudan 'calisiyor' bir iş açar (oto/cron tetiği). Kuyruğa yazıp sonra
 * almak iki turlu olurdu; zamanlayıcı zaten "şimdi çalıştır" diyor.
 * Kilit doluysa `null` döner.
 */
export async function otoIsAc(
  tur: SenkronTuru,
  tetik: SenkronTetik = "oto",
): Promise<SenkronIsi | null> {
  try {
    const [satir] = await db
      .insert(senkronIsleri)
      .values({ tur, tetik, durum: "calisiyor", baslangic: new Date() })
      .returning();
    return satir ?? null;
  } catch (hata) {
    if (tekillikIhlaliMi(hata)) return null;
    throw hata;
  }
}

export async function ilerlemeYaz(
  id: string,
  ilerleme: SenkronIlerlemesi,
): Promise<void> {
  await db
    .update(senkronIsleri)
    .set({ ilerleme })
    .where(eq(senkronIsleri.id, id));
}

export async function bitir(
  id: string,
  durum: Extract<SenkronDurumu, "tamam" | "hata" | "iptal">,
  mesaj: string,
  hatalar?: string[],
): Promise<void> {
  await db
    .update(senkronIsleri)
    .set({
      durum,
      bitis: new Date(),
      mesaj: mesaj.slice(0, 1000),
      hatalar: hatalar && hatalar.length ? hatalar.slice(0, 20) : null,
    })
    .where(eq(senkronIsleri.id, id));
}

/**
 * Kullanıcının "Şimdi senkronla" düğmesi. AYNI ENTEGRASYON için bekleyen ya da
 * çalışan iş varsa yeni iş AÇILMAZ: düğmeye üst üste basmak kuyruğu şişirir,
 * Trendyol'u 429'a sokardı.
 */
export async function manuelIsEkle(
  k: Kapsam,
  tur: SenkronTuru,
  entegrasyonId: string,
): Promise<{ eklendi: boolean; is: SenkronIsi | null }> {
  const mevcut = await db
    .select({ id: senkronIsleri.id })
    .from(senkronIsleri)
    .where(
      and(
        eq(senkronIsleri.tur, tur),
        eq(senkronIsleri.entegrasyonId, entegrasyonId),
        inArray(senkronIsleri.durum, ["bekliyor", "calisiyor"]),
      ),
    )
    .limit(1);
  if (mevcut.length) return { eklendi: false, is: null };

  const [satir] = await db
    .insert(senkronIsleri)
    .values({
      tur,
      tetik: "manuel",
      sirketId: k.sirketId,
      entegrasyonId,
      durum: "bekliyor",
    })
    .returning();
  return { eklendi: true, is: satir ?? null };
}

/** Arayüzün gördüğü iş satırı (ham `ilerleme` jsonb tiplenmiş hâliyle). */
export interface IsOzeti {
  id: string;
  tur: SenkronTuru;
  tetik: string;
  durum: SenkronDurumu;
  baslangic: Date | null;
  bitis: Date | null;
  mesaj: string | null;
  hatalar: string[] | null;
  ilerleme: SenkronIlerlemesi | null;
}

export interface SenkronDurumOzeti {
  calisiyor: IsOzeti | null;
  sonIs: IsOzeti | null;
  gecmis: IsOzeti[];
}

function ozete(satir: SenkronIsi): IsOzeti {
  return {
    id: satir.id,
    tur: satir.tur,
    tetik: satir.tetik,
    durum: satir.durum,
    baslangic: satir.baslangic,
    bitis: satir.bitis,
    mesaj: satir.mesaj,
    hatalar: Array.isArray(satir.hatalar) ? (satir.hatalar as string[]) : null,
    ilerleme: (satir.ilerleme as SenkronIlerlemesi | null) ?? null,
  };
}

/**
 * Şirketin gördüğü senkron durumu.
 *
 * OTO İŞLER ŞİRKETSİZDİR (`sirket_id is null`): tek iş tüm kiracıların vadesi
 * gelen entegrasyonlarını çeker. Bu yüzden filtre "benim şirketim VEYA
 * şirketsiz"dir; ilerlemede her entegrasyonun kendi sayacı durur
 * (`ilerleme.tamamlanan`), dolayısıyla başka kiracının sipariş sayısı
 * görünmez - yalnız ortak iş "çalışıyor" bilgisi paylaşılır.
 */
export async function durumOzeti(sirketId: string): Promise<SenkronDurumOzeti> {
  const kapsam = or(
    eq(senkronIsleri.sirketId, sirketId),
    isNull(senkronIsleri.sirketId),
  );

  const [calisan] = await db
    .select()
    .from(senkronIsleri)
    .where(and(eq(senkronIsleri.durum, "calisiyor"), kapsam))
    .orderBy(desc(senkronIsleri.baslangic))
    .limit(1);

  const gecmis = await db
    .select()
    .from(senkronIsleri)
    .where(and(inArray(senkronIsleri.durum, ["tamam", "hata", "iptal"]), kapsam))
    .orderBy(desc(senkronIsleri.createdAt))
    .limit(5);

  return {
    calisiyor: calisan ? ozete(calisan) : null,
    sonIs: gecmis[0] ? ozete(gecmis[0]) : null,
    gecmis: gecmis.map(ozete),
  };
}

/** Geçmişi sınırlı tutar: kuyruk tablosu sonsuza kadar büyümesin. */
export async function eskiIsleriSil(gun = 14): Promise<number> {
  const satirlar = await db
    .delete(senkronIsleri)
    .where(
      and(
        inArray(senkronIsleri.durum, ["tamam", "hata", "iptal"]),
        sql`${senkronIsleri.createdAt} < now() - interval '${sql.raw(String(Math.max(1, Math.round(gun))))} days'`,
      ),
    )
    .returning({ id: senkronIsleri.id });
  return satirlar.length;
}
