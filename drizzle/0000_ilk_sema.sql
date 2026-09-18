CREATE TYPE "public"."kullanici_rolu" AS ENUM('super_admin', 'admin', 'calisan');--> statement-breakpoint
CREATE TYPE "public"."okutma_modu" AS ENUM('hizli', 'rehberli', 'toplama');--> statement-breakpoint
CREATE TYPE "public"."senkron_durumu" AS ENUM('bekliyor', 'calisiyor', 'tamam', 'hata', 'iptal');--> statement-breakpoint
CREATE TYPE "public"."senkron_turu" AS ENUM('siparis', 'urun');--> statement-breakpoint
CREATE TABLE "barkod_kurallari" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid,
	"barkod_oneki" text NOT NULL,
	"kaynak" text NOT NULL,
	"kargo_firmasi" text NOT NULL,
	"oncelik" integer DEFAULT 100 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"aciklama" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entegrasyonlar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"ad" text,
	"satici_id" text NOT NULL,
	"api_key_sifreli" text NOT NULL,
	"api_secret_sifreli" text NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"son_siparis_senkron" timestamp with time zone,
	"son_urun_senkron" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kullanicilar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"telefon" text NOT NULL,
	"parola_hash" text NOT NULL,
	"ad" text NOT NULL,
	"rol" "kullanici_rolu" DEFAULT 'calisan' NOT NULL,
	"okutma_modu" "okutma_modu",
	"profil_gorsel" text,
	"aktif" boolean DEFAULT true NOT NULL,
	"hatali_deneme" integer DEFAULT 0 NOT NULL,
	"kilit_bitis" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kullanicilar_telefon_unique" UNIQUE("telefon")
);
--> statement-breakpoint
CREATE TABLE "paket_okutmalari" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"kullanici_id" uuid NOT NULL,
	"barkod" text NOT NULL,
	"okutma_zamani" timestamp with time zone DEFAULT now() NOT NULL,
	"okutan_ad" text NOT NULL,
	"kaynak" text,
	"kargo_firmasi" text,
	"entegrasyon_adi" text
);
--> statement-breakpoint
CREATE TABLE "pazaryeri_siparisleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"siparis_kimligi" text NOT NULL,
	"siparis_no" text,
	"kargo_takip_no" text,
	"durum" text DEFAULT 'Created' NOT NULL,
	"siparis_tarihi" timestamp with time zone,
	"ham_veri" jsonb,
	"icerik_imzasi" text,
	"hazir_zamani" timestamp with time zone,
	"kargo_zamani" timestamp with time zone,
	"yazdirma_zamani" timestamp with time zone,
	"entegrasyon_adi" text,
	"kargo_firmasi" text,
	"atanan_kullanici_id" uuid,
	"atama_zamani" timestamp with time zone,
	"son_guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senkron_isleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tur" "senkron_turu" NOT NULL,
	"tetik" text NOT NULL,
	"sirket_id" uuid,
	"entegrasyon_id" uuid,
	"durum" "senkron_durumu" DEFAULT 'bekliyor' NOT NULL,
	"baslangic" timestamp with time zone,
	"bitis" timestamp with time zone,
	"ilerleme" jsonb,
	"mesaj" text,
	"hatalar" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sirketler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad" text NOT NULL,
	"alan_adi" text,
	"azami_entegrasyon" integer,
	"fatura_paylas_acik" boolean DEFAULT false NOT NULL,
	"fatura_kesim_acik" boolean DEFAULT false NOT NULL,
	"mail_acik" boolean DEFAULT false NOT NULL,
	"varsayilan_okutma_modu" "okutma_modu" DEFAULT 'hizli' NOT NULL,
	"senkron_aralik_dk" numeric(5, 1) DEFAULT '2' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sirketler_ad_unique" UNIQUE("ad"),
	CONSTRAINT "sirketler_alan_adi_unique" UNIQUE("alan_adi"),
	CONSTRAINT "sirketler_senkron_aralik_chk" CHECK ("sirketler"."senkron_aralik_dk" >= 2 AND "sirketler"."senkron_aralik_dk" <= 60)
);
--> statement-breakpoint
CREATE TABLE "urunler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"barkod" text NOT NULL,
	"urun_adi" text,
	"gorsel_url" text,
	"marka" text,
	"kategori" text,
	"stok_kodu" text,
	"son_senkron" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "barkod_kurallari" ADD CONSTRAINT "barkod_kurallari_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD CONSTRAINT "entegrasyonlar_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kullanicilar" ADD CONSTRAINT "kullanicilar_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paket_okutmalari" ADD CONSTRAINT "paket_okutmalari_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paket_okutmalari" ADD CONSTRAINT "paket_okutmalari_kullanici_id_kullanicilar_id_fk" FOREIGN KEY ("kullanici_id") REFERENCES "public"."kullanicilar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pazaryeri_siparisleri" ADD CONSTRAINT "pazaryeri_siparisleri_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pazaryeri_siparisleri" ADD CONSTRAINT "pazaryeri_siparisleri_atanan_kullanici_id_kullanicilar_id_fk" FOREIGN KEY ("atanan_kullanici_id") REFERENCES "public"."kullanicilar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senkron_isleri" ADD CONSTRAINT "senkron_isleri_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senkron_isleri" ADD CONSTRAINT "senkron_isleri_entegrasyon_id_entegrasyonlar_id_fk" FOREIGN KEY ("entegrasyon_id") REFERENCES "public"."entegrasyonlar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urunler" ADD CONSTRAINT "urunler_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "barkod_kurallari_kapsam_onek_uq" ON "barkod_kurallari" USING btree (coalesce("sirket_id", '00000000-0000-0000-0000-000000000000'::uuid),"barkod_oneki");--> statement-breakpoint
CREATE INDEX "barkod_kurallari_aktif_idx" ON "barkod_kurallari" USING btree ("aktif");--> statement-breakpoint
CREATE UNIQUE INDEX "entegrasyonlar_sirket_platform_satici_uq" ON "entegrasyonlar" USING btree ("sirket_id","platform","satici_id");--> statement-breakpoint
CREATE INDEX "entegrasyonlar_aktif_idx" ON "entegrasyonlar" USING btree ("aktif");--> statement-breakpoint
CREATE INDEX "kullanicilar_sirket_idx" ON "kullanicilar" USING btree ("sirket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paket_okutmalari_sirket_barkod_uq" ON "paket_okutmalari" USING btree ("sirket_id","barkod");--> statement-breakpoint
CREATE INDEX "paket_okutmalari_sirket_zaman_idx" ON "paket_okutmalari" USING btree ("sirket_id","okutma_zamani" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "paket_okutmalari_kullanici_idx" ON "paket_okutmalari" USING btree ("kullanici_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pazaryeri_siparisleri_kimlik_uq" ON "pazaryeri_siparisleri" USING btree ("sirket_id","platform","siparis_kimligi");--> statement-breakpoint
CREATE INDEX "pazaryeri_siparisleri_sirket_durum_idx" ON "pazaryeri_siparisleri" USING btree ("sirket_id","durum");--> statement-breakpoint
CREATE INDEX "pazaryeri_siparisleri_takip_idx" ON "pazaryeri_siparisleri" USING btree ("kargo_takip_no");--> statement-breakpoint
CREATE INDEX "pazaryeri_siparisleri_tarih_idx" ON "pazaryeri_siparisleri" USING btree ("siparis_tarihi");--> statement-breakpoint
CREATE INDEX "pazaryeri_siparisleri_atanan_idx" ON "pazaryeri_siparisleri" USING btree ("atanan_kullanici_id");--> statement-breakpoint
CREATE INDEX "pazaryeri_siparisleri_toplama_idx" ON "pazaryeri_siparisleri" USING btree ("sirket_id","kargo_firmasi","icerik_imzasi") WHERE "pazaryeri_siparisleri"."hazir_zamani" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "senkron_isleri_tek_calisan_uq" ON "senkron_isleri" USING btree ("tur") WHERE "senkron_isleri"."durum" = 'calisiyor';--> statement-breakpoint
CREATE INDEX "senkron_isleri_created_idx" ON "senkron_isleri" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "senkron_isleri_durum_idx" ON "senkron_isleri" USING btree ("durum");--> statement-breakpoint
CREATE UNIQUE INDEX "urunler_sirket_barkod_uq" ON "urunler" USING btree ("sirket_id","barkod");--> statement-breakpoint
CREATE INDEX "urunler_barkod_idx" ON "urunler" USING btree ("barkod");