CREATE TYPE "public"."mal_kabul_turu" AS ENUM('kabul', 'iade', 'duzeltme');--> statement-breakpoint
CREATE TABLE "mal_kabul_kalemleri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mal_kabul_id" uuid NOT NULL,
	"sirket_id" uuid NOT NULL,
	"barkod" text NOT NULL,
	"adet" integer NOT NULL,
	"urun_adi" text
);
--> statement-breakpoint
CREATE TABLE "mal_kabuller" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sirket_id" uuid NOT NULL,
	"tur" "mal_kabul_turu" DEFAULT 'kabul' NOT NULL,
	"tarih" timestamp with time zone DEFAULT now() NOT NULL,
	"irsaliye_no" text,
	"not" text,
	"kaydeden_id" uuid,
	"kaydeden_ad" text NOT NULL,
	"kalem_sayisi" integer DEFAULT 0 NOT NULL,
	"toplam_adet" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mal_kabul_kalemleri" ADD CONSTRAINT "mal_kabul_kalemleri_mal_kabul_id_mal_kabuller_id_fk" FOREIGN KEY ("mal_kabul_id") REFERENCES "public"."mal_kabuller"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mal_kabul_kalemleri" ADD CONSTRAINT "mal_kabul_kalemleri_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mal_kabuller" ADD CONSTRAINT "mal_kabuller_sirket_id_sirketler_id_fk" FOREIGN KEY ("sirket_id") REFERENCES "public"."sirketler"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mal_kabuller" ADD CONSTRAINT "mal_kabuller_kaydeden_id_kullanicilar_id_fk" FOREIGN KEY ("kaydeden_id") REFERENCES "public"."kullanicilar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mal_kabul_kalemleri_sirket_barkod_idx" ON "mal_kabul_kalemleri" USING btree ("sirket_id","barkod");--> statement-breakpoint
CREATE INDEX "mal_kabul_kalemleri_fis_idx" ON "mal_kabul_kalemleri" USING btree ("mal_kabul_id");--> statement-breakpoint
CREATE INDEX "mal_kabuller_sirket_tarih_idx" ON "mal_kabuller" USING btree ("sirket_id","tarih" DESC NULLS LAST);