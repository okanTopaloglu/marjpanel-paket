CREATE TYPE "public"."teklif_durumu" AS ENUM('yeni', 'arandi', 'kazanildi', 'kaybedildi');--> statement-breakpoint
CREATE TABLE "teklif_talepleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telefon" text NOT NULL,
	"ad" text,
	"sirket" text,
	"eposta" text,
	"aylik_paket" text,
	"pazaryerleri" text,
	"mesaj" text,
	"durum" "teklif_durumu" DEFAULT 'yeni' NOT NULL,
	"whatsapp_acildi" boolean DEFAULT false NOT NULL,
	"notlar" text,
	"kaynak" text,
	"kampanya" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kullanicilar" ADD COLUMN "eposta" text;--> statement-breakpoint
CREATE INDEX "teklif_talepleri_zaman_idx" ON "teklif_talepleri" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "teklif_talepleri_durum_idx" ON "teklif_talepleri" USING btree ("durum","created_at" DESC NULLS LAST);