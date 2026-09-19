/**
 * MarjPanel Paket veri modeli (Drizzle ORM / PostgreSQL).
 *
 * Kurallar:
 *  - Çok kiracılılık `sirket_id` sütunuyla sağlanır. Kiracıya ait her tabloda
 *    NOT NULL'dur; tek istisna `barkod_kurallari` (NULL = platform varsayılanı).
 *    Her repo fonksiyonu kapsamı (sirketId) açık parametre olarak alır.
 *  - Birincil anahtar uuid: PartnerSys'ten taşınan ham SQL'ler (atama claim,
 *    toplu upsert) uuid ile çalışır.
 *  - Zaman damgaları timestamptz; gün/saat gruplamaları sorguda
 *    `AT TIME ZONE 'Europe/Istanbul'` ile yapılır.
 *  - Auth.js JWT stratejisi kullanır; adapter tabloları yoktur.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Ortak sütunlar                                                      */
/* ------------------------------------------------------------------ */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/* ------------------------------------------------------------------ */
/* Enum'lar                                                            */
/* ------------------------------------------------------------------ */
/** super_admin: platform sahibi, tüm şirketler. admin: kendi şirketi. calisan: okutur. */
export const kullaniciRoluEnum = pgEnum("kullanici_rolu", [
  "super_admin",
  "admin",
  "calisan",
]);
export type KullaniciRolu = (typeof kullaniciRoluEnum.enumValues)[number];

/** hizli: okut-kaydet. rehberli: + sipariş içeriği. toplama: atama sistemi. */
export const okutmaModuEnum = pgEnum("okutma_modu", [
  "hizli",
  "rehberli",
  "toplama",
]);
export type OkutmaModu = (typeof okutmaModuEnum.enumValues)[number];

export const senkronTuruEnum = pgEnum("senkron_turu", ["siparis", "urun"]);
export type SenkronTuru = (typeof senkronTuruEnum.enumValues)[number];

export const senkronDurumuEnum = pgEnum("senkron_durumu", [
  "bekliyor",
  "calisiyor",
  "tamam",
  "hata",
  "iptal",
]);
export type SenkronDurumu = (typeof senkronDurumuEnum.enumValues)[number];

/* ------------------------------------------------------------------ */
/* Şirketler (kiracı)                                                  */
/* ------------------------------------------------------------------ */
export const sirketler = pgTable(
  "sirketler",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ad: text("ad").notNull().unique(),
    alanAdi: text("alan_adi").unique(),
    /** NULL = sınırsız entegrasyon. */
    azamiEntegrasyon: integer("azami_entegrasyon"),
    faturaPaylasAcik: boolean("fatura_paylas_acik").notNull().default(false),
    faturaKesimAcik: boolean("fatura_kesim_acik").notNull().default(false),
    mailAcik: boolean("mail_acik").notNull().default(false),
    varsayilanOkutmaModu: okutmaModuEnum("varsayilan_okutma_modu")
      .notNull()
      .default("hizli"),
    /** Otomatik sipariş senkron aralığı (dakika), 2..60. */
    senkronAralikDk: numeric("senkron_aralik_dk", { precision: 5, scale: 1 })
      .notNull()
      .default("2"),
    ...timestamps,
  },
  (t) => [
    check(
      "sirketler_senkron_aralik_chk",
      sql`${t.senkronAralikDk} >= 2 AND ${t.senkronAralikDk} <= 60`,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* Kullanıcılar                                                        */
/* ------------------------------------------------------------------ */
export const kullanicilar = pgTable(
  "kullanicilar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    /** Kanonik biçim: 5XXXXXXXXX (lib/format/telefon). Girişin tek kimliği. */
    telefon: text("telefon").notNull().unique(),
    parolaHash: text("parola_hash").notNull(),
    ad: text("ad").notNull(),
    rol: kullaniciRoluEnum("rol").notNull().default("calisan"),
    /** NULL = şirketin varsayılan modu kullanılır. */
    okutmaModu: okutmaModuEnum("okutma_modu"),
    /** Diskteki dosya adı (GORSEL_DIZIN); /g/<dosya> ile servis edilir. */
    profilGorsel: text("profil_gorsel"),
    aktif: boolean("aktif").notNull().default(true),
    hataliDeneme: integer("hatali_deneme").notNull().default(0),
    kilitBitis: timestamp("kilit_bitis", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("kullanicilar_sirket_idx").on(t.sirketId)],
);

/* ------------------------------------------------------------------ */
/* Paket okutmaları                                                    */
/* ------------------------------------------------------------------ */
export const paketOkutmalari = pgTable(
  "paket_okutmalari",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    kullaniciId: uuid("kullanici_id")
      .notNull()
      .references(() => kullanicilar.id, { onDelete: "cascade" }),
    barkod: text("barkod").notNull(),
    okutmaZamani: timestamp("okutma_zamani", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Denormalize: kullanıcı silinse de listede ad kalır. */
    okutanAd: text("okutan_ad").notNull(),
    kaynak: text("kaynak"),
    kargoFirmasi: text("kargo_firmasi"),
    entegrasyonAdi: text("entegrasyon_adi"),
  },
  (t) => [
    uniqueIndex("paket_okutmalari_sirket_barkod_uq").on(t.sirketId, t.barkod),
    index("paket_okutmalari_sirket_zaman_idx").on(
      t.sirketId,
      t.okutmaZamani.desc(),
    ),
    index("paket_okutmalari_kullanici_idx").on(t.kullaniciId),
  ],
);

/* ------------------------------------------------------------------ */
/* Barkod kuralları                                                    */
/* ------------------------------------------------------------------ */
/** Sıfır uuid: NULL sirket_id'li global kuralların tekillik anahtarı. */
export const SIFIR_UUID = "00000000-0000-0000-0000-000000000000";

export const barkodKurallari = pgTable(
  "barkod_kurallari",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** NULL = platform varsayılanı (seed); dolu = şirkete özel kural. */
    sirketId: uuid("sirket_id").references(() => sirketler.id, {
      onDelete: "cascade",
    }),
    barkodOneki: text("barkod_oneki").notNull(),
    kaynak: text("kaynak").notNull(),
    kargoFirmasi: text("kargo_firmasi").notNull(),
    /** Küçük değer önce denenir; eşitlikte uzun önek kazanır. */
    oncelik: integer("oncelik").notNull().default(100),
    aktif: boolean("aktif").notNull().default(true),
    aciklama: text("aciklama"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("barkod_kurallari_kapsam_onek_uq").on(
      sql`coalesce(${t.sirketId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.barkodOneki,
    ),
    index("barkod_kurallari_aktif_idx").on(t.aktif),
  ],
);

/* ------------------------------------------------------------------ */
/* Ürünler                                                             */
/* ------------------------------------------------------------------ */
export const urunler = pgTable(
  "urunler",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    barkod: text("barkod").notNull(),
    urunAdi: text("urun_adi"),
    gorselUrl: text("gorsel_url"),
    marka: text("marka"),
    kategori: text("kategori"),
    stokKodu: text("stok_kodu"),
    sonSenkron: timestamp("son_senkron", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("urunler_sirket_barkod_uq").on(t.sirketId, t.barkod),
    index("urunler_barkod_idx").on(t.barkod),
  ],
);

/* ------------------------------------------------------------------ */
/* Entegrasyonlar (pazaryeri API bağlantıları)                          */
/* ------------------------------------------------------------------ */
export const entegrasyonlar = pgTable(
  "entegrasyonlar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    /** Pazaryeri anahtarı (`lib/pazaryeri/tipler` Platform); doğrulama zod'da, CHECK yok. */
    platform: text("platform").notNull(),
    /** Mağaza etiketi (kullanıcının verdiği ad). */
    ad: text("ad"),
    /**
     * Hesap kimliği — platformun "hangi mağaza" alanı (Trendyol satıcı ID,
     * Hepsiburada merchant ID, Amazon seller ID). Kimlik JSON'undan
     * kopyalanır; tekillik ve liste görünümü için düz sütun.
     */
    saticiId: text("satici_id").notNull(),
    /**
     * Kimlik bilgileri: AES-256-GCM(JSON) (`lib/pazaryeri/kimlik`). Platform
     * başına alan kümesi farklı olduğu için tek şifreli JSON sütunu.
     * Düz metin asla saklanmaz.
     */
    kimlikSifreli: text("kimlik_sifreli"),
    /** ESKİ (yalnız Trendyol): kimlik_sifreli dolduğunda okunmaz; 0003'te düşer. */
    apiKeySifreli: text("api_key_sifreli"),
    apiSecretSifreli: text("api_secret_sifreli"),
    /** Gizli olmayan platform ayarları: saatOfseti, sandbox, marketplaceId… */
    ayarlar: jsonb("ayarlar").notNull().default(sql`'{}'::jsonb`),
    aktif: boolean("aktif").notNull().default(true),
    sonSiparisSenkron: timestamp("son_siparis_senkron", { withTimezone: true }),
    sonUrunSenkron: timestamp("son_urun_senkron", { withTimezone: true }),
    /** Son senkron hatası (kimlik/hız sınırı); başarılı turda temizlenir. */
    sonHata: text("son_hata"),
    sonHataZamani: timestamp("son_hata_zamani", { withTimezone: true }),
    /** Bu ana kadar senkron denenmez (429 / 401 sonrası geri çekilme). */
    ertelemeBitis: timestamp("erteleme_bitis", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("entegrasyonlar_sirket_platform_satici_uq").on(
      t.sirketId,
      t.platform,
      t.saticiId,
    ),
    index("entegrasyonlar_aktif_idx").on(t.aktif),
    index("entegrasyonlar_sirket_platform_idx").on(t.sirketId, t.platform),
  ],
);

/* ------------------------------------------------------------------ */
/* Pazaryeri siparişleri                                               */
/* ------------------------------------------------------------------ */
export const pazaryeriSiparisleri = pgTable(
  "pazaryeri_siparisleri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    /** Pazaryerinin paket/sipariş kimliği (Trendyol: shipmentPackageId). */
    siparisKimligi: text("siparis_kimligi").notNull(),
    siparisNo: text("siparis_no"),
    kargoTakipNo: text("kargo_takip_no"),
    /** KANONİK durum (lib/siparis/sabitler): Created/Picking/Invoiced/Shipped/Delivered/Cancelled/Returned… */
    durum: text("durum").notNull().default("Created"),
    /** Pazaryerinin verdiği ham durum metni (eşleme sorunlarını izlemek için). */
    hamDurum: text("ham_durum"),
    siparisTarihi: timestamp("siparis_tarihi", { withTimezone: true }),
    /** Pazaryeri yükünün tamamı; istemciye yalnız asgari alt küme iner. */
    hamVeri: jsonb("ham_veri"),
    /** `barkod:adet|barkod:adet` (barkoda göre sıralı); toplama gruplaması. */
    icerikImzasi: text("icerik_imzasi"),
    hazirZamani: timestamp("hazir_zamani", { withTimezone: true }),
    kargoZamani: timestamp("kargo_zamani", { withTimezone: true }),
    yazdirmaZamani: timestamp("yazdirma_zamani", { withTimezone: true }),
    entegrasyonAdi: text("entegrasyon_adi"),
    kargoFirmasi: text("kargo_firmasi"),
    /** Toplama modunda paketi üstlenen çalışan; silinirse havuza döner. */
    atananKullaniciId: uuid("atanan_kullanici_id").references(
      () => kullanicilar.id,
      { onDelete: "set null" },
    ),
    atamaZamani: timestamp("atama_zamani", { withTimezone: true }),
    sonGuncelleme: timestamp("son_guncelleme", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("pazaryeri_siparisleri_kimlik_uq").on(
      t.sirketId,
      t.platform,
      t.siparisKimligi,
    ),
    index("pazaryeri_siparisleri_sirket_durum_idx").on(t.sirketId, t.durum),
    index("pazaryeri_siparisleri_sirket_platform_idx").on(t.sirketId, t.platform),
    index("pazaryeri_siparisleri_takip_idx").on(t.kargoTakipNo),
    index("pazaryeri_siparisleri_tarih_idx").on(t.siparisTarihi),
    index("pazaryeri_siparisleri_atanan_idx").on(t.atananKullaniciId),
    index("pazaryeri_siparisleri_toplama_idx")
      .on(t.sirketId, t.kargoFirmasi, t.icerikImzasi)
      .where(sql`${t.hazirZamani} IS NULL`),
  ],
);

/* ------------------------------------------------------------------ */
/* Senkron işleri (kuyruk + kilit + ilerleme + geçmiş)                  */
/* ------------------------------------------------------------------ */
export const senkronIsleri = pgTable(
  "senkron_isleri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tur: senkronTuruEnum("tur").notNull(),
    /** oto | manuel | cron */
    tetik: text("tetik").notNull(),
    /** NULL = tüm şirketlerin vadesi gelen entegrasyonları (oto tur). */
    sirketId: uuid("sirket_id").references(() => sirketler.id, {
      onDelete: "cascade",
    }),
    entegrasyonId: uuid("entegrasyon_id").references(() => entegrasyonlar.id, {
      onDelete: "set null",
    }),
    /** NULL = tüm platformlar. Platform başına paralel kilit (M6-D) için ayrılmıştır. */
    platform: text("platform"),
    durum: senkronDurumuEnum("durum").notNull().default("bekliyor"),
    baslangic: timestamp("baslangic", { withTimezone: true }),
    bitis: timestamp("bitis", { withTimezone: true }),
    /**
     * NABIZ: her ilerleme yazımında güncellenir. Bayat kilit kontrolü
     * `baslangic`a değil buna bakar; 10 dakikalık meşru ürün işi 6. dakikada
     * "süreç düştü" diye kesilmez.
     */
    sonNabiz: timestamp("son_nabiz", { withTimezone: true }),
    /** { adim, entegrasyon, sayfa, toplamSayfa, apiden, yazilan, tamamlanan: {ad: sayi} } */
    ilerleme: jsonb("ilerleme"),
    mesaj: text("mesaj"),
    hatalar: jsonb("hatalar"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /** Aynı türden yalnız bir iş çalışabilir: süreçler arası kilit. */
    uniqueIndex("senkron_isleri_tek_calisan_uq")
      .on(t.tur)
      .where(sql`${t.durum} = 'calisiyor'`),
    index("senkron_isleri_created_idx").on(t.createdAt.desc()),
    index("senkron_isleri_durum_idx").on(t.durum),
  ],
);

/* ------------------------------------------------------------------ */
/* İlişkiler                                                           */
/* ------------------------------------------------------------------ */
export const sirketlerRelations = relations(sirketler, ({ many }) => ({
  kullanicilar: many(kullanicilar),
  paketOkutmalari: many(paketOkutmalari),
  urunler: many(urunler),
  entegrasyonlar: many(entegrasyonlar),
  siparisler: many(pazaryeriSiparisleri),
  barkodKurallari: many(barkodKurallari),
}));

export const kullanicilarRelations = relations(kullanicilar, ({ one, many }) => ({
  sirket: one(sirketler, {
    fields: [kullanicilar.sirketId],
    references: [sirketler.id],
  }),
  paketOkutmalari: many(paketOkutmalari),
}));

export const paketOkutmalariRelations = relations(paketOkutmalari, ({ one }) => ({
  sirket: one(sirketler, {
    fields: [paketOkutmalari.sirketId],
    references: [sirketler.id],
  }),
  kullanici: one(kullanicilar, {
    fields: [paketOkutmalari.kullaniciId],
    references: [kullanicilar.id],
  }),
}));

export const pazaryeriSiparisleriRelations = relations(
  pazaryeriSiparisleri,
  ({ one }) => ({
    sirket: one(sirketler, {
      fields: [pazaryeriSiparisleri.sirketId],
      references: [sirketler.id],
    }),
    atanan: one(kullanicilar, {
      fields: [pazaryeriSiparisleri.atananKullaniciId],
      references: [kullanicilar.id],
    }),
  }),
);

/* ------------------------------------------------------------------ */
/* Tipler                                                              */
/* ------------------------------------------------------------------ */
export type Sirket = typeof sirketler.$inferSelect;
export type Kullanici = typeof kullanicilar.$inferSelect;
export type PaketOkutma = typeof paketOkutmalari.$inferSelect;
export type BarkodKurali = typeof barkodKurallari.$inferSelect;
export type Urun = typeof urunler.$inferSelect;
export type Entegrasyon = typeof entegrasyonlar.$inferSelect;
export type PazaryeriSiparisi = typeof pazaryeriSiparisleri.$inferSelect;
export type SenkronIsi = typeof senkronIsleri.$inferSelect;
