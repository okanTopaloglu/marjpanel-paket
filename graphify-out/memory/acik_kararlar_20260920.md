---
type: "open_questions"
date: "2026-09-20T00:00:00+00:00"
question: "Sistemde hangi kararlar hala acik ve hangi tuzaklar biliniyor?"
contributor: "graphify"
source_nodes: ["kargoTakipNo", "hazirIsaretle()", "tarifeler", "sarfMalzemeleri", "Amazon Iki Katmanli Kimlik (uygulama LWA + satici refresh token)", "Dogrulanacaklar"]
---

# Q: Sistemde hangi kararlar hala acik ve hangi tuzaklar biliniyor?

## Answer

ACIK KARARLAR (2026-09-20, kullaniciya sorulmus ama cevaplanmamis ya da bilerek ertelenmis):

1. ESLESMESIZ PAKET: okutulan barkod hicbir siparise denk gelmezse paket kaydedilir ama
   kalem bilgisi olmadigi icin STOK DUSMEZ. Elle kalem girisi eklenecek mi belli degil.
2. FATURA KESIMI: `hesap_kesimleri` yalniz fatura NO tutar; e-fatura/e-arsiv entegrasyonu yok.
3. AMAZON: `kargoTakipNo = AmazonOrderId` olarak esleniyor (gercek takip no SP-API'de ayri
   cagri ister). Depo etiketi AmazonOrderId basmiyorsa okutma eslesmez.
4. HEPSIBURADA: yalniz PAKETLENMIS siparisler cekiliyor; paketlenmemis siparis panelde gorunmez.
5. GERCEK API ANAHTARLARI hicbir pazaryeri icin girilmedi; `AMAZON_LWA_CLIENT_ID/SECRET`
   ortam degiskenleri Coolify'da TANIMSIZ. Tum docs/pazaryeri/*.md dosyalarindaki
   "Dogrulanacaklar" listeleri canli hesapla kapatilmayi bekliyor.
6. GUVENLIK: super admin parolasi hala 123456 (kullanici bilerek boyle istedi).
   Coolify API token'i sohbette paylasildi; kullaniciya iptal edip yenilemesi onerildi.
7. TARIFE/SARF VERISI YOK: hicbir sirkete tarife tanimlanmadi (pano "tarife yok" gosterir),
   hicbir sarf malzemesi tanimlanmadi (stok eksiye duser). Sistem calisir ama bos.

BILINEN TUZAKLAR:
- AST, `db.transaction(async (tx) => ...)` callback'i icindeki cagrilari YAKALAYAMIYOR.
  Ornek: `okutmaKaydet` icindeki `hazirIsaretle` (paketler.ts:197) grafikte `calls` kenari
  olarak yok, yalniz `imports` var. Ayni kor nokta toplama atamasi ve mal kabulde de olabilir.
- `drizzle/meta/*_snapshot.json` dosyalari grafigi kirletiyor: her migration snapshot'i sutun
  adlarini ayri dugum yapiyor, ~150 anlamsiz "Drizzle Snapshot" toplulugu ve dusuk cohesion
  uretiyor. Yeniden kurarken bu klasoru haric tutmak daha temiz grafik verir.
- Yerel `pnpm build` DATABASE_URL olmadigi icin sayfa verisi toplarken durur (derleme basarili).
  Coolify'daki Docker build sorunsuz gecer; bu bir hata degil.

## Source Nodes

- kargoTakipNo
- hazirIsaretle()
- tarifeler
- sarfMalzemeleri
- Amazon Iki Katmanli Kimlik (uygulama LWA + satici refresh token)
- Dogrulanacaklar
