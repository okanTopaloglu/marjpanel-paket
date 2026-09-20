CREATE TYPE "public"."site_olayi_turu" AS ENUM('goruntuleme', 'eposta', 'telefon', 'teklif', 'kayit', 'giris', 'sss');--> statement-breakpoint
CREATE TABLE "site_olaylari" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tur" "site_olayi_turu" NOT NULL,
	"yol" text DEFAULT '/' NOT NULL,
	"etiket" text,
	"yonlendiren" text,
	"kaynak" text,
	"kampanya" text,
	"cihaz" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "site_olaylari_zaman_idx" ON "site_olaylari" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "site_olaylari_tur_zaman_idx" ON "site_olaylari" USING btree ("tur","created_at" DESC NULLS LAST);