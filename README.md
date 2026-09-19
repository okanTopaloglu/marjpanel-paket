# MarjPanel Paket

Depo ekipleri için **barkod tabanlı paket okutma ve pazaryeri sipariş takibi**.
MarjPanel markası ve "Mürekkep & Nane" tasarım sistemi ile; çok kiracılı (şirket
bazlı), telefon + parola ile giriş.

## Ne yapar

- **Paket okut**: USB barkod tabancası ya da telefon kamerası ile kargo barkodu
  okutulur; mükerrer, iptal edilmiş ve zaten kargolanmış paketler anında engellenir.
  Üç mod: **Hızlı** (okut-kaydet), **Rehberli** (sipariş içeriği görsellerle),
  **Toplama** (kargo firması seç → içerik-benzer ~20 paket atanır → toplama
  listesi → tek tek paketle, barkod eşleşme doğrulamalı).
- **Siparişler**: Trendyol siparişleri otomatik çekilir (2-60 dk, şirket bazlı),
  sekmeler (bekleyen, hazır, kargoda, iptal, 17:00 öncesi sevk edilmemiş),
  termal kargo etiketi yazdırma (100x120 mm), eski kayıt temizliği.
- **Ürünler**: Trendyol katalog senkronu, Excel içe aktarım, elle düzenleme;
  rehberli/toplama modlarında ürün görselleri.
- **Barkod kuralları**: önek → kaynak/kargo eşlemesi; platform varsayılanları +
  şirkete özel kurallar.
- **Kullanıcılar / Şirketler**: roller `super_admin` (platform), `admin` (şirket),
  `calisan` (okutur); kullanıcı başına okutma modu; şirket başına özellik bayrakları.
- **Özet**: çalışan/kaynak/kargo bazında sayımlar, günlük seri, saat x gün ısı
  haritası, haftalık büyüme.

## Yığın

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3.4 · Drizzle ORM +
PostgreSQL 16 · Auth.js v5 (Credentials, argon2, JWT) · exceljs · jsbarcode /
qrcode · html5-qrcode · vitest. Redis/worker yok: senkron zamanlayıcısı
`instrumentation.ts` ile sürecin içinde koşar, kilit veritabanındadır.

## Geliştirme

```bash
cp .env.example .env          # değerleri doldurun
pnpm install
docker compose up -d postgres # ya da kendi Postgres 16'nız
pnpm db:migrate
pnpm db:seed                  # global barkod kuralları + ilk şirket/süper yönetici
pnpm dev                      # http://localhost:3000
```

İlk giriş: `.env`'deki `SEED_ADMIN_TELEFON` / `SEED_ADMIN_PAROLA`.

| Komut | Açıklama |
|---|---|
| `pnpm dev` / `build` / `start` | Geliştirme / üretim derleme / çalıştırma |
| `pnpm typecheck` / `lint` / `test` | TypeScript / ESLint / vitest |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Migration üret / uygula / tohumla |
| `pnpm ikon:uret` | Marka ikonları ve OG görseli |

Geliştirme betikleri `scripts/dev/*.ts` (`pnpm exec tsx --env-file=.env ...`)
repo katmanını gerçek veritabanına karşı dener.

## Mimari notlar

- **Kiracı izolasyonu**: her sunucu işlemi `Kapsam` (`lib/auth/kapsam.ts`) alır;
  `sirketId` yalnız oturumdan türetilir, istemciden asla okunmaz. Yetki kapıları
  (`lib/auth/yetki.ts`) her istekte DB'den taze rol okur; JWT'deki role güvenilmez.
- **Okutma tek transaction**: mükerrer kontrolü, sipariş durumu, kural çözümü,
  kayıt ve "hazır" damgası tek server action'da (`actions/okut.ts`).
- **Toplama ataması**: `FOR UPDATE SKIP LOCKED` ile yarış güvenli; içerik imzası
  (`barkod:adet|...`) upsert anında hesaplanır.
- **Pazaryeri soyutlaması** (`lib/pazaryeri`): motor platform bilmez. Her
  pazaryeri `PazaryeriSaglayici` sözleşmesini uygular (bağlantı testi, opak
  imleçli sipariş/ürün sayfaları, kanonik durum); kimlik alanları, rozet
  rengi ve yetenekler `kayit.ts` kayıt defterinde (`hazir:false` olanlar
  arayüzde "Yakında"). Kimlik tek şifreli JSON sütununda
  (`entegrasyonlar.kimlik_sifreli`). Sağlayıcının normalize ettiği müşteri/
  adres/kalemler `ham_veri._normal` zarfında; etiket ve okutma oradan okur.
  Hazır: Trendyol, Hepsiburada, N11 (`docs/pazaryeri/*.md`). Sırada: Pazarama,
  idefix, Amazon.
- **Senkron**: `senkron_isleri` tablosu kuyruk + kilit (kısmi tekil indeks) +
  nabız (`son_nabiz`; 5 dk nabızsız iş bayat sayılır) + ilerleme + geçmiş.
  429 alan entegrasyon `Retry-After` kadar, 401 alan bir saat ertelenir;
  hata kartta görünür, entegrasyon pasife alınmaz. `/api/cron/senkron` (`Authorization: Bearer CRON_SECRET`)
  dış tetik; gizli anahtar boşsa 401.
- **Trendyol anahtarları** AES-256-GCM ile şifreli (`APP_ENCRYPTION_KEY`),
  arayüze yalnız maskeli iner.
- Tarih/saat her yerde `Europe/Istanbul`.

## Dağıtım

Coolify (kendi sunucunuz), Dockerfile build pack, tek uygulama + PostgreSQL.
Adım adım: [`docs/DEPLOY-COOLIFY.md`](docs/DEPLOY-COOLIFY.md).

## Tasarım

[`DESIGN.md`](DESIGN.md): tek vurgu rengi (nane), mürekkep menü, tabular rakamlar,
44 px dokunma hedefi, hareket yalnız transform/opacity.

Bu kurulum **MAMA AURA** için markalanmıştır (giriş, menü, simge, OG kartı);
MarjPanel altyapı notu olarak kalır. Kaynak logo `scripts/marka/`, türevler
`pnpm ikon:uret` (bkz. DESIGN.md "Müşteri markası").
