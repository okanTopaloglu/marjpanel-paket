ALTER TABLE "sirketler" DROP CONSTRAINT "sirketler_senkron_aralik_chk";--> statement-breakpoint
ALTER TABLE "sirketler" ALTER COLUMN "senkron_aralik_dk" SET DEFAULT '0.5';--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD COLUMN "son_genis_tarama" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sirketler" ADD COLUMN "sevk_kesim_saati" integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE "sirketler" ADD CONSTRAINT "sirketler_sevk_kesim_chk" CHECK ("sirketler"."sevk_kesim_saati" >= 0 AND "sirketler"."sevk_kesim_saati" <= 23);--> statement-breakpoint
ALTER TABLE "sirketler" ADD CONSTRAINT "sirketler_senkron_aralik_chk" CHECK ("sirketler"."senkron_aralik_dk" >= 0.5 AND "sirketler"."senkron_aralik_dk" <= 60);--> statement-breakpoint
UPDATE "sirketler" SET "senkron_aralik_dk" = 0.5;