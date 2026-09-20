# Google Search Console ve Bing Webmaster Tools bağlantısı

Tanıtım sayfasının arama performansını (hangi sorgu, kaçıncı sıra, kaç
tıklama) platform yönetimi ekranında göstermek için gereken adımlar.

Ziyaret ve tıklama ölçümü ZATEN ÇALIŞIYOR (`site_olaylari` tablosu, kendi
altyapımız). Search Console bunun yerine geçmez, yanına gelir: kendi
ölçümümüz "sayfada ne oldu", Search Console "arama sonucunda ne oldu"
sorusunu cevaplar.

## 1. Siteyi doğrulayın

Search Console'da **URL öneki** türünü seçin ve `https://paket.marjpanel.com`
girin. Doğrulama için en kolay yol **HTML etiketi**:

Verilen `<meta name="google-site-verification" content="..." />` etiketinin
`content` değerini alın ve Coolify'da uygulamaya ortam değişkeni olarak
ekleyin:

```
GOOGLE_SITE_VERIFICATION=<content değeri>
```

Kod tarafı hazır: `src/app/(site)/tanitim/page.tsx` içindeki
`generateMetadata` bu değişkeni okuyup `verification.google` alanına yazar.
Değişken tanımsızsa etiket hiç basılmaz (boş etiket basmak doğrulamayı
bozardı).

Bing için aynısı: `BING_SITE_VERIFICATION`.

Alternatif: DNS TXT kaydı (Cloudflare'de `marjpanel.com` bölgesine). Alan adı
doğrulaması tüm alt alan adlarını kapsar, ayrıca dağıtım gerektirmez.

## 2. Site haritasını bildirin

Search Console → Site Haritaları → `sitemap.xml` ekleyin. Adres zaten
canlıda ve `robots.txt` içinde de bildiriliyor.

## 3. Bing'i atlamayın

ChatGPT'nin arama kipi ve Copilot büyük ölçüde Bing dizinini kullanır.
Bing Webmaster Tools'a Search Console'dan içe aktarma yapılabilir; ayrı
doğrulama gerekmez.

## 4. API bağlantısı (isteğe bağlı, sonraki adım)

Arama sorgularını platform ekranında göstermek için Search Console API
gerekir:

1. Google Cloud Console'da proje açın, **Search Console API**'yi etkinleştirin.
2. **Hizmet hesabı** oluşturun, JSON anahtarını indirin.
3. Search Console → Ayarlar → Kullanıcılar ve izinler → hizmet hesabının
   e-postasını **tam** yetkiyle ekleyin.
4. JSON anahtarını Coolify'a ortam değişkeni olarak verin:
   `GSC_SERVICE_ACCOUNT_JSON` (tek satır JSON).

Bu adım tamamlandığında `searchanalytics.query` ucundan son 28 günün
sorguları çekilip `/platform` ekranına eklenecek. Anahtar verilene kadar o
bölüm "bağlı değil" durumunda kalır; uydurma veri gösterilmez.

## Notlar

- Doğrulama etiketi YALNIZ platform adresinde basılır. Kiracı adresleri
  (`sirket.marjpanel.com`) `robots.txt` ile tamamen kapalıdır ve
  doğrulanmamalıdır.
- `llms.txt` ve JSON-LD zaten yayında; Search Console bunları ayrıca
  doğrulamaz ama AI arama motorları okur.
