ALTER TABLE "entegrasyonlar" ALTER COLUMN "api_key_sifreli" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ALTER COLUMN "api_secret_sifreli" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD COLUMN "kimlik_sifreli" text;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD COLUMN "ayarlar" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD COLUMN "son_hata" text;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD COLUMN "son_hata_zamani" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entegrasyonlar" ADD COLUMN "erteleme_bitis" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pazaryeri_siparisleri" ADD COLUMN "ham_durum" text;--> statement-breakpoint
ALTER TABLE "senkron_isleri" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "senkron_isleri" ADD COLUMN "son_nabiz" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "entegrasyonlar_sirket_platform_idx" ON "entegrasyonlar" USING btree ("sirket_id","platform");--> statement-breakpoint
CREATE INDEX "pazaryeri_siparisleri_sirket_platform_idx" ON "pazaryeri_siparisleri" USING btree ("sirket_id","platform");