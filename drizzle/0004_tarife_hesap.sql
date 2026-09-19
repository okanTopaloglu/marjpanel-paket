CREATE TYPE "public"."kesim_durumu" AS ENUM('taslak', 'kesildi', 'odendi', 'iptal');--> statement-breakpoint
CREATE TYPE "public"."kesim_kalemi_turu" AS ENUM('paket', 'ek_hizmet', 'diger');--> statement-breakpoint
CREATE TABLE "hesap_kesim_kalemleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kesim_id" uuid NOT NULL,
	"sira" integer DEFAULT 0 NOT NULL,
	"tur" "kesim_kalemi_turu" NOT NULL,
	"aciklama" text NOT NULL,
	"adet" numeric(12, 2) NOT NULL,
	"birim_fiyat" numeric(12, 2) NOT NULL,
	"tutar" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hesap_kesimleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"donem" text NOT NULL,
	"durum" "kesim_durumu" DEFAULT 'taslak' NOT NULL,
	"paket_sayisi" integer DEFAULT 0 NOT NULL,
	"ara_toplam" numeric(12, 2) DEFAULT '0' NOT NULL,
	"kdv_orani" numeric(5, 2) DEFAULT '20' NOT NULL,
	"kdv_tutari" numeric(12, 2) DEFAULT '0' NOT NULL,
	"genel_toplam" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fatura_no" text,
	"kesim_tarihi" timestamp with time zone,
	"vade_tarihi" date,
	"not" text,
	"kaydeden_ad" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odemeler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"kesim_id" uuid,
	"tarih" date NOT NULL,
	"tutar" numeric(12, 2) NOT NULL,
	"yontem" text DEFAULT 'havale' NOT NULL,
	"not" text,
	"kaydeden_ad" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifeler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"gecerlilik_baslangic" date NOT NULL,
	"kademe_tipi" text DEFAULT 'toplam' NOT NULL,
	"kademeler" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ek_hizmetler" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kdv_orani" numeric(5, 2) DEFAULT '20' NOT NULL,
	"not" text,
	"kaydeden_ad" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hesap_kesim_kalemleri" ADD CONSTRAINT "hesap_kesim_kalemleri_kesim_id_hesap_kesimleri_id_fk" FOREIGN KEY ("kesim_id") REFERENCES "public"."hesap_kesimleri"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hesap_kesimleri" ADD CONSTRAINT "hesap_kesimleri_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odemeler" ADD CONSTRAINT "odemeler_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odemeler" ADD CONSTRAINT "odemeler_kesim_id_hesap_kesimleri_id_fk" FOREIGN KEY ("kesim_id") REFERENCES "public"."hesap_kesimleri"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifeler" ADD CONSTRAINT "tarifeler_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hesap_kesim_kalemleri_kesim_idx" ON "hesap_kesim_kalemleri" USING btree ("kesim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hesap_kesimleri_sirket_donem_uq" ON "hesap_kesimleri" USING btree ("sirket_id","donem");--> statement-breakpoint
CREATE INDEX "hesap_kesimleri_durum_idx" ON "hesap_kesimleri" USING btree ("durum");--> statement-breakpoint
CREATE INDEX "odemeler_sirket_tarih_idx" ON "odemeler" USING btree ("sirket_id","tarih" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tarifeler_sirket_gecerlilik_idx" ON "tarifeler" USING btree ("sirket_id","gecerlilik_baslangic" DESC NULLS LAST);