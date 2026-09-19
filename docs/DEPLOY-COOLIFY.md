# MarjPanel Paket - Coolify ile Yayına Alma

Kendi sunucunuzda Coolify, Dockerfile tabanlı **tek uygulama + PostgreSQL**.
Coolify reverse proxy ve otomatik HTTPS (Let's Encrypt) sağlar; Caddy/nginx
gerekmez. Konteyner başlarken migration + seed otomatik çalışır (entrypoint).
Redis ve ayrı worker YOKTUR: senkron zamanlayıcısı uygulamanın içinde koşar.

## 0. Ön koşullar

- Coolify kurulu ve çalışıyor.
- Alan adının DNS A kaydı sunucu IP'sine bakıyor (örn. `paket.alanadiniz.com`).
- Bu depo GitHub'da (`okanTopaloglu/marjpanel-paket`, `main` dalı). Private
  olduğu için Coolify'a GitHub App ile erişim verin.

## 1. Proje + ortam

**New Project** → içinde bir **Environment** (production). Postgres ve App
aynı proje/ortamda olsun ki iç ağda birbirlerini görsünler.

## 2. PostgreSQL kaynağı

**+ New Resource → Databases → PostgreSQL 16**. Başlatın. Coolify'ın verdiği
**iç bağlantı URL'sini** kopyalayın:
`postgres://postgres:PAROLA@<servis-adi>:5432/postgres` → `DATABASE_URL`.
Public port açmanıza gerek yok.

## 3. Uygulama

**+ New Resource → Application → Private Repository (GitHub App)** → depo.

| Alan | Değer |
|---|---|
| Build Pack | `Dockerfile` |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` |
| Branch | `main` |
| Ports Exposes | `3000` |

### Ortam değişkenleri (App → Environment Variables)

| Anahtar | Değer |
|---|---|
| `DATABASE_URL` | Adım 2'deki iç URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `APP_URL` | `https://paket.marjpanel.com` (PLATFORM adresi; kiracılar `sirket.marjpanel.com`dan girer) |
| `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` (Trendyol anahtarlarını şifreler; SABİT KALMALI) |
| `CRON_SECRET` | `openssl rand -hex 24` (boşsa `/api/cron/senkron` 401 döner) |
| `SENKRON_ZAMANLAYICI` | `1` |
| `GORSEL_DIZIN` | `/app/uploads` |
| `SEED_SIRKET_AD` | İlk şirketin adı |
| `SEED_ADMIN_TELEFON` | `05XXXXXXXXX` (süper yönetici girişi) |
| `SEED_ADMIN_PAROLA` | Güçlü parola (ilk girişten sonra değiştirin) |
| `SEED_ADMIN_AD` | Adınız |
| `SEED_SIRKET_ALAN_ADI` / `SEED_SIRKET_MARKA_ADI` / `SEED_SIRKET_LOGO` / `SEED_SIRKET_LOGO_KOYU` | İlk şirketin giriş adresi, marka adı ve logo dosya yolları (isteğe bağlı; yalnız boş alanları doldurur) |
| `KAYIT_ACIK` | `0` (şirketler kendi kendine kayıt olamasın; siz açarsınız) |
| `TRENDYOL_API_BASE` | `https://apigw.trendyol.com` |
| `TRENDYOL_SIPARIS_SAAT_OFSETI` | `3` |
| `AMAZON_LWA_CLIENT_ID` / `AMAZON_LWA_CLIENT_SECRET` | Amazon kullanılacaksa; uygulamanın LWA kimliği (docs/pazaryeri/amazon.md) |
| `NODE_ENV` | `production` |

> `AUTH_SECRET` ve `APP_ENCRYPTION_KEY` sonradan değişirse oturumlar düşer ve
> kayıtlı Trendyol API anahtarları çözülemez (entegrasyonlar yeniden girilir).

### Kalıcı depolama (profil görselleri) - İLK DEPLOY'DAN ÖNCE

App → **Storages** → **+ Add** → Source `/app/uploads`, Destination `/app/uploads`.
Eklenmezse her deploy'da yüklenen profil görselleri silinir.

### Domain — çok kiracılı

App → **Domains**: platform adresi (`https://paket.marjpanel.com`, `APP_URL`
ile aynı) + HER KİRACININ giriş adresi (`https://sirket.marjpanel.com`,
virgülle). DNS'te `*.marjpanel.com` wildcard A kaydı sunucuya bakar; Let's
Encrypt sertifikası Coolify'a eklenen her domain için ayrı alınır. Yeni şirket
açıp alan adı verdiğinizde domaini buraya da ekleyin (yoksa sertifika yok).

Uygulama `Host` başlığından kiracıyı bulur (`sirketler.alan_adi`): şirketin
logosu ve adı görünür, MarjPanel "altyapı" notu kalır. Tanınmayan host
platform kimliğiyle açılır.

### Health check

App → **Health Checks**: Path `/api/saglik`, Port `3000`, Start period `60` sn
(ilk açılışta migration çalışır).

### Replika

**1 replika.** Zamanlayıcı süreç içinde koşar; iki replika iki zamanlayıcı
demektir (DB kilidi çift işi engeller ama Trendyol hız sınırı ikiye bölünür).

## 4. Deploy

**Deploy**. Loglarda sırayla:
`[init] Veritabanı migration'ları uygulanıyor...` → `[init] Seed...` →
`[init] Next.js sunucusu başlatılıyor.` → `[senkron] zamanlayıcı başladı`.

## 5. İlk giriş

`https://paket.alanadiniz.com/giris` → `SEED_ADMIN_TELEFON` / `SEED_ADMIN_PAROLA`.
Sonra: Ayarlar → parolayı değiştirin; Şirketler → şirketleri açın;
Kullanıcılar → çalışanları ekleyin; Entegrasyonlar → Trendyol anahtarlarını girin.

## 6. Yedekleme

Coolify → PostgreSQL kaynağı → **Backups**: zamanlanmış yedek (S3 veya yerel).

## 7. Güncelleme

`git push` → Coolify webhook ile otomatik deploy (ya da Redeploy). Migration'lar
her açılışta idempotent çalışır.

## 8. Dış cron (isteğe bağlı)

Süreç içi zamanlayıcıyı kapatıp (`SENKRON_ZAMANLAYICI=0`) Coolify **Scheduled
Task** ile tetiklemek isterseniz, her dakika:

```
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://paket.alanadiniz.com/api/cron/senkron
```

## Sorun giderme

- **`/api/saglik` 503** → `DATABASE_URL` yanlış ya da Postgres aynı ağda değil.
- **Kamera açılmıyor** → yalnız HTTPS'te çalışır; domain üzerinden test edin.
- **Trendyol 401/403** → API key/secret veya satıcı ID hatalı; Entegrasyonlar →
  "Bağlantıyı test et".
- **Görseller kayboldu** → `/app/uploads` volume eklenmemiş (yukarı bakın).
