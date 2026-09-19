# Amazon SP-API (TR) — notlar (M6-D)

Kaynak: Amazon Selling Partner API genel belgesi (Orders v0, Tokens
2021-03-01, LWA). SigV4/IAM imzalama Ekim 2023'te kaldırıldı; yalnız LWA
erişim jetonu gerekir.

## Kimlik — iki katman

| Kime ait | Nerede | Alanlar |
|---|---|---|
| **Uygulama** (MarjPanel Paket) | ortam değişkeni | `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET` — Seller Central → Develop Apps'te kaydedilen uygulamanın LWA kimliği |
| **Satıcı** | entegrasyon kaydı (şifreli) | `sellerId` (Merchant Token), `refreshToken` (uygulamayı yetkilendirince üretilen jeton) |

Uygulama kimliği yoksa bağlantı testi bunu söyler; sağlayıcı sipariş
çekmez. v1'de **self-authorization** (satıcı kendi uygulamasını Seller
Central'dan yetkilendirip refresh token'ı kopyalar); OAuth geri dönüş ucu
sonraki sürüm.

- LWA: `POST https://api.amazon.com/auth/o2/token`
  `grant_type=refresh_token&refresh_token=…&client_id=…&client_secret=…`
  → `access_token` (~1 saat). Süreç içi önbellek, satıcı başına.
- SP-API EU ucu: `https://sellingpartnerapi-eu.amazon.com`, başlık
  `x-amz-access-token`. Sandbox: `https://sandbox.sellingpartnerapi-eu.amazon.com`
  (statik sahte yanıtlar; `ayarlar.sandbox`).
- Türkiye marketplace: `A33AVAJ2PDY3EV` (`ayarlar.marketplaceId` ezer).

## Siparişler (Orders v0)

`GET /orders/v0/orders?MarketplaceIds=…&LastUpdatedAfter=ISO&LastUpdatedBefore=ISO&FulfillmentChannels=MFN&MaxResultsPerPage=100[&NextToken=…]`
→ `{ payload: { Orders: [...], NextToken?, LastUpdatedBefore } }`.
İmleç = `NextToken` (opak). **Hız: 0,0167 istek/sn (dakikada bir), patlama
20** → `sayfaArasiMs: 60000`. `azamiPencereGun: null` (tek pencere,
`LastUpdatedAfter` açık uçlu).

Sipariş alanları: `AmazonOrderId`, `OrderStatus` (Pending,
PendingAvailability, Unshipped, PartiallyShipped, Shipped, Canceled,
Unfulfillable, InvoiceUnconfirmed), `PurchaseDate`, `LastUpdateDate`,
`FulfillmentChannel` (MFN/AFN), `ShippingAddress` ve `BuyerInfo` (**yalnız
RDT ile**), `NumberOfItemsUnshipped/Shipped`.

Kalemler ayrı istek: `GET /orders/v0/orders/{AmazonOrderId}/orderItems` →
`payload.OrderItems[] { ASIN, SellerSKU, Title, QuantityOrdered }`. Hız
0,5/sn (patlama 30) → kalem istekleri arasında 2100 ms. Kalem barkodu =
`SellerSKU` (EAN SP-API'de yok; ürün tablosu SKU ile eşleşmeli).

**Karar (kullanıcıyla doğrulanacak):** MFN siparişinde kargo takip numarası
satıcı kargolayınca doğar, SP-API'de gelmez. Havuz ve etiket için
`kargoTakipNo = AmazonOrderId` (`123-1234567-1234567`); depoda okutulan
barkod sipariş numarasıdır.

### RDT (kişisel veri)

Ad/adres/telefon için `POST /tokens/2021-03-01/restrictedDataToken`
`{ restrictedResources: [{ method: "GET", path: "/orders/v0/orders",
dataElements: ["buyerInfo", "shippingAddress"] }] }` → `restrictedDataToken`
(60 dk), `x-amz-access-token` olarak kullanılır. Uygulamanın **PII rolü**
onaylı olmalı (Amazon onayı haftalar sürebilir). `ayarlar.piiOnayli` true
değilse adressiz satır yazılır; etiket basılamaz ama havuz çalışır.

### Durum eşlemesi

| Amazon | Kanonik |
|---|---|
| Pending, PendingAvailability | Created |
| Unshipped, PartiallyShipped, InvoiceUnconfirmed | Picking |
| Shipped | Shipped |
| Canceled | Cancelled |
| Unfulfillable | UnSupplied |

## Ürünler

v1'de `urun: false`: katalog Reports API (`GET_MERCHANT_LISTINGS_ALL_DATA`,
dakikalar süren rapor) ister; okutma ekranı SKU'yu ürün tablosunda Excel
içe aktarımıyla bulur.

## Doğrulanacaklar

1. LWA uygulama kaydı (client id/secret) ve satıcı refresh token'ı.
2. PII rolü onayı; yoksa adressiz akış kabul mü.
3. `kargoTakipNo = AmazonOrderId` kararı.
4. 429 `x-amzn-RateLimit-Limit` başlığı ile geri çekilme.
