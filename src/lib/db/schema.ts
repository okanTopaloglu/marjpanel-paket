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
  date,
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
    /**
     * Kiracının giriş adresi (host, küçük harf, port yok: "mamaaura.marjpanel.com").
     * Middleware/layout `Host` başlığıyla buradan kiracıyı çözer; NULL ise
     * şirket platform adresinden (paket.marjpanel.com) girer.
     */
    alanAdi: text("alan_adi").unique(),
    /** Arayüzde görünen kısa marka adı; NULL ise `ad`. */
    markaAdi: text("marka_adi"),
    /** Açık zemin logosu (`/g/<dosya>`); NULL ise ad metin olarak yazılır. */
    logoDosya: text("logo_dosya"),
    /** Mürekkep menü için açık renkli logo; NULL ise açık logo beyaz plakada. */
    logoKoyuDosya: text("logo_koyu_dosya"),
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
/* ==================================================================== */
/* DEPO OPERASYONU (Faz B) — mal kabul ve stok                          */
/* ==================================================================== */

/** kabul: şirket mal yolladı (+) · iade: şirkete geri gönderildi (−) · duzeltme: sayım farkı (±) */
export const malKabulTuruEnum = pgEnum("mal_kabul_turu", ["kabul", "iade", "duzeltme"]);
export type MalKabulTuru = (typeof malKabulTuruEnum.enumValues)[number];

/**
 * Mal kabul fişi — kiracının depoya yolladığı (ya da geri aldığı) mal.
 * STOK = fiş kalemlerinin işaretli toplamı − okutulan paketlerin kalemleri
 * (repos/stok). Çıkış ayrı yazılmaz; okutma zaten var.
 */
export const malKabuller = pgTable(
  "mal_kabuller",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    tur: malKabulTuruEnum("tur").notNull().default("kabul"),
    tarih: timestamp("tarih", { withTimezone: true }).notNull().defaultNow(),
    irsaliyeNo: text("irsaliye_no"),
    not: text("not"),
    kaydedenId: uuid("kaydeden_id").references(() => kullanicilar.id, { onDelete: "set null" }),
    /** Denormalize: kullanıcı silinse de fişte kim kaydettiği kalır. */
    kaydedenAd: text("kaydeden_ad").notNull(),
    kalemSayisi: integer("kalem_sayisi").notNull().default(0),
    /** Kalemlerin işaretli toplamı (iade/düzeltme eksi olabilir). */
    toplamAdet: integer("toplam_adet").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("mal_kabuller_sirket_tarih_idx").on(t.sirketId, t.tarih.desc())],
);

export const malKabulKalemleri = pgTable(
  "mal_kabul_kalemleri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    malKabulId: uuid("mal_kabul_id")
      .notNull()
      .references(() => malKabuller.id, { onDelete: "cascade" }),
    /** Denormalize: stok toplamı fişe join etmeden barkod bazında alınır. */
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    barkod: text("barkod").notNull(),
    /** STOK ETKİSİ, işaretli: kabul +, iade −, düzeltme ±. */
    adet: integer("adet").notNull(),
    /** Kayıt anındaki ürün adı (katalogdan); ürün sonradan silinse de fiş okunur. */
    urunAdi: text("urun_adi"),
  },
  (t) => [
    index("mal_kabul_kalemleri_sirket_barkod_idx").on(t.sirketId, t.barkod),
    index("mal_kabul_kalemleri_fis_idx").on(t.malKabulId),
  ],
);

export type MalKabul = typeof malKabuller.$inferSelect;
export type MalKabulKalemi = typeof malKabulKalemleri.$inferSelect;

/* ==================================================================== */
/* FİNANS (Faz B) — tarife, hesap kesimi, ödeme                          */
/* ==================================================================== */

/**
 * Tarife — şirket başına, geçerlilik tarihli. Kesim, dönemin ilk günü
 * itibarıyla geçerli en son tarifeyi kullanır; eski kesimler değişmez (tutar
 * kesim anında kalemlere yazılır).
 *
 * `kademeler`: [{ ustSinir: 500, birimFiyat: 15 }, { ustSinir: null, birimFiyat: 12 }]
 * `kademeTipi`: "toplam" → aylık adedin düştüğü kademenin fiyatı TÜM paketlere;
 *               "dilimli" → her dilim kendi fiyatıyla (vergi dilimi gibi).
 * `ekHizmetler`: [{ kod: "patpat", ad: "Patpat sarma", birimFiyat: 2 }]
 */
export const tarifeler = pgTable(
  "tarifeler",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    gecerlilikBaslangic: date("gecerlilik_baslangic").notNull(),
    kademeTipi: text("kademe_tipi").notNull().default("toplam"),
    kademeler: jsonb("kademeler").notNull().default(sql`'[]'::jsonb`),
    ekHizmetler: jsonb("ek_hizmetler").notNull().default(sql`'[]'::jsonb`),
    kdvOrani: numeric("kdv_orani", { precision: 5, scale: 2 }).notNull().default("20"),
    not: text("not"),
    kaydedenAd: text("kaydeden_ad").notNull(),
    ...timestamps,
  },
  (t) => [index("tarifeler_sirket_gecerlilik_idx").on(t.sirketId, t.gecerlilikBaslangic.desc())],
);

export const kesimDurumuEnum = pgEnum("kesim_durumu", ["taslak", "kesildi", "odendi", "iptal"]);
export type KesimDurumu = (typeof kesimDurumuEnum.enumValues)[number];

/** Aylık hesap kesimi — şirket + dönem (YYYY-MM) tekil. Tutarlar kuruş hassasiyetinde. */
export const hesapKesimleri = pgTable(
  "hesap_kesimleri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    donem: text("donem").notNull(),
    durum: kesimDurumuEnum("durum").notNull().default("taslak"),
    paketSayisi: integer("paket_sayisi").notNull().default(0),
    araToplam: numeric("ara_toplam", { precision: 12, scale: 2 }).notNull().default("0"),
    kdvOrani: numeric("kdv_orani", { precision: 5, scale: 2 }).notNull().default("20"),
    kdvTutari: numeric("kdv_tutari", { precision: 12, scale: 2 }).notNull().default("0"),
    genelToplam: numeric("genel_toplam", { precision: 12, scale: 2 }).notNull().default("0"),
    faturaNo: text("fatura_no"),
    kesimTarihi: timestamp("kesim_tarihi", { withTimezone: true }),
    vadeTarihi: date("vade_tarihi"),
    not: text("not"),
    kaydedenAd: text("kaydeden_ad").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("hesap_kesimleri_sirket_donem_uq").on(t.sirketId, t.donem),
    index("hesap_kesimleri_durum_idx").on(t.durum),
  ],
);

export const kesimKalemiTuruEnum = pgEnum("kesim_kalemi_turu", ["paket", "ek_hizmet", "diger"]);

export const hesapKesimKalemleri = pgTable(
  "hesap_kesim_kalemleri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kesimId: uuid("kesim_id")
      .notNull()
      .references(() => hesapKesimleri.id, { onDelete: "cascade" }),
    sira: integer("sira").notNull().default(0),
    tur: kesimKalemiTuruEnum("tur").notNull(),
    aciklama: text("aciklama").notNull(),
    adet: numeric("adet", { precision: 12, scale: 2 }).notNull(),
    birimFiyat: numeric("birim_fiyat", { precision: 12, scale: 2 }).notNull(),
    tutar: numeric("tutar", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("hesap_kesim_kalemleri_kesim_idx").on(t.kesimId)],
);

/** Ödeme — kesime bağlı ya da serbest (avans). Bakiye = kesilen − ödenen. */
export const odemeler = pgTable(
  "odemeler",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sirketId: uuid("sirket_id")
      .notNull()
      .references(() => sirketler.id, { onDelete: "cascade" }),
    kesimId: uuid("kesim_id").references(() => hesapKesimleri.id, { onDelete: "set null" }),
    tarih: date("tarih").notNull(),
    tutar: numeric("tutar", { precision: 12, scale: 2 }).notNull(),
    /** havale | nakit | kredi_karti | diger */
    yontem: text("yontem").notNull().default("havale"),
    not: text("not"),
    kaydedenAd: text("kaydeden_ad").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("odemeler_sirket_tarih_idx").on(t.sirketId, t.tarih.desc())],
);

/* ==================================================================== */
/* SARF MALZEMELERİ (Faz B) — platform düzeyi, şirket yok                */
/* ==================================================================== */

/**
 * Sarf malzemesi (koli, patpat, bant, kargo poşeti). TÜKETİM YAZILMAZ,
 * TÜRETİLİR: `normBaslangic`tan itibaren okutulan paket × `paketBasiNorm`.
 * Stok = alımlar + sayım düzeltmeleri − türetilen tüketim (repos/sarf).
 * Böylece günlük iş gerekmez; sayım girildiğinde gerçekle hizalanır.
 */
export const sarfMalzemeleri = pgTable("sarf_malzemeleri", {
  id: uuid("id").primaryKey().defaultRandom(),
  ad: text("ad").notNull().unique(),
  /** adet, metre, rulo, kg… (yalnız görünüm) */
  birim: text("birim").notNull().default("adet"),
  /** Son alım birim maliyeti (TL); gider tahmini için. */
  birimMaliyet: numeric("birim_maliyet", { precision: 12, scale: 4 }).notNull().default("0"),
  /** Paket başına tüketim (birim cinsinden, ondalık olabilir: bant 0,3 m). */
  paketBasiNorm: numeric("paket_basi_norm", { precision: 10, scale: 4 }).notNull().default("0"),
  /** Norm bu tarihten itibaren okutulan paketlere uygulanır. */
  normBaslangic: date("norm_baslangic").notNull().defaultNow(),
  /** Bu seviyenin altı "kritik". */
  kritikSeviye: numeric("kritik_seviye", { precision: 12, scale: 2 }).notNull().default("0"),
  aktif: boolean("aktif").notNull().default(true),
  ...timestamps,
});

/** alim: + · sayim: stoğu bu değere EŞİTLER (fark yazılır) · duzeltme: ± */
export const sarfHareketiTuruEnum = pgEnum("sarf_hareketi_turu", ["alim", "sayim", "duzeltme"]);

export const sarfHareketleri = pgTable(
  "sarf_hareketleri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sarfId: uuid("sarf_id")
      .notNull()
      .references(() => sarfMalzemeleri.id, { onDelete: "cascade" }),
    tur: sarfHareketiTuruEnum("tur").notNull(),
    /** Stok etkisi, işaretli. Sayımda: sayılan − o anki hesaplanan stok. */
    miktar: numeric("miktar", { precision: 12, scale: 2 }).notNull(),
    /** Alımda toplam tutar (TL); birim maliyet buradan güncellenir. */
    tutar: numeric("tutar", { precision: 12, scale: 2 }),
    tarih: date("tarih").notNull(),
    not: text("not"),
    kaydedenAd: text("kaydeden_ad").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sarf_hareketleri_sarf_tarih_idx").on(t.sarfId, t.tarih.desc())],
);

export type SarfMalzemesi = typeof sarfMalzemeleri.$inferSelect;
export type SarfHareketi = typeof sarfHareketleri.$inferSelect;

export type Tarife = typeof tarifeler.$inferSelect;
export type HesapKesimi = typeof hesapKesimleri.$inferSelect;
export type HesapKesimKalemi = typeof hesapKesimKalemleri.$inferSelect;
export type Odeme = typeof odemeler.$inferSelect;

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
