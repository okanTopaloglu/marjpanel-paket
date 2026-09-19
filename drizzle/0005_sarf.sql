CREATE TYPE "public"."sarf_hareketi_turu" AS ENUM('alim', 'sayim', 'duzeltme');--> statement-breakpoint
CREATE TABLE "sarf_hareketleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sarf_id" uuid NOT NULL,
	"tur" "sarf_hareketi_turu" NOT NULL,
	"miktar" numeric(12, 2) NOT NULL,
	"tutar" numeric(12, 2),
	"tarih" date NOT NULL,
	"not" text,
	"kaydeden_ad" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sarf_malzemeleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad" text NOT NULL,
	"birim" text DEFAULT 'adet' NOT NULL,
	"birim_maliyet" numeric(12, 4) DEFAULT '0' NOT NULL,
	"paket_basi_norm" numeric(10, 4) DEFAULT '0' NOT NULL,
	"norm_baslangic" date DEFAULT now() NOT NULL,
	"kritik_seviye" numeric(12, 2) DEFAULT '0' NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sarf_malzemeleri_ad_unique" UNIQUE("ad")
);
--> statement-breakpoint
ALTER TABLE "sarf_hareketleri" ADD CONSTRAINT "sarf_hareketleri_sarf_id_sarf_malzemeleri_id_fk" FOREIGN KEY ("sarf_id") REFERENCES "public"."sarf_malzemeleri"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sarf_hareketleri_sarf_tarih_idx" ON "sarf_hareketleri" USING btree ("sarf_id","tarih" DESC NULLS LAST);