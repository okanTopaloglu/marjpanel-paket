# Pazarama — API notları (M6-C)

Kaynaklar (2026-09-19): resmi PDF (`cdn.pazarama.com/.../APIEntegrasyonDokumani`)
bot korumalı; bilgiler dört açık kaynak istemciden türetildi
(`wiensa/pazarama-sp-api`, `BoraBayraktar/beemmb`, `kivancagaogluu/pazarama`,
`developkariyer/iwapim`). Sipariş yanıtının alan adları ve durum kodları
**kısmen doğrulandı**; ilk canlı senkronda `[pazaryeri] pazarama: tanınmayan
sipariş durumu` uyarıları tabloyu tamamlatır.

## Kimlik doğrulama — OAuth2 client credentials

- Anahtarlar: İş Ortağım paneli → Hesap Bilgileri → Entegrasyon Bilgileri
  (API Key = client id, API Secret = client secret).
- Jeton: `POST https://isortagimgiris.pazarama.com/connect/token`,
  `Authorization: Basic base64(clientId:clientSecret)`,
  gövde `grant_type=client_credentials&scope=merchantgatewayapi.fullaccess`
  (form-urlencoded). Yanıt `{ data: { accessToken, expiresIn? } }` ya da
  düz `{ access_token, expires_in }` — ikisi de kabul edilir. Süre ~3600 sn;
  süreç içinde clientId başına önbelleklenir, 55 dk'da yenilenir, 401'de bir
  kez tazelenip tekrar denenir.
- API: `https://isortagimapi.pazarama.com`, `Authorization: Bearer <jeton>`.
- Hız sınırı: ~60/dk (üçüncü taraf yapılandırmasından; **doğrulanmalı**).

## Sipariş listeleme

`POST /order/getOrdersForApi` — gövde **form-urlencoded**:
`StartDate`, `EndDate` (ISO 8601), `Page` (**1 tabanlı**), `Size` (≤100).
Bazı istemciler JSON gövde de yolluyor; form seçildi (iki bağımsız kaynak).

Yanıt zarfı değişken: `{ data: [...] }`, `{ data: { data|items: [...] } }`,
`{ items: [...] }`; `totalPages`/`totalCount` bazen `data` içinde. İstemci
hepsini kabul eder; toplam yoksa dolmamış sayfa bitiştir.

Sipariş alanları (birden çok ad görüldü, sırayla denenir):

| Normal | Adaylar |
|---|---|
| kimlik | `packageNumber`, `orderNumber`, `orderCode`, `orderId`, `id` |
| sipariş no | `orderNumber`, `orderCode` |
| takip no | `cargoTrackingNumber`, `trackingNumber`, `shippingTrackingNumber` |
| kargo | `cargoCompanyName`, `cargoProviderName`, `cargoCompany` |
| durum | `status`, `orderStatus` (sayı ya da metin) |
| tarih | `orderDate`, `createdDate`, `lastModifiedDate` |
| müşteri | `customerFullName`, `customerName` |
| adres | `shippingAddress` / `shipmentAddress` → `address`/`addressDetail`, `city`, `district`/`town`, `phone`/`gsm` |
| kalemler | `lines` / `orderItems` / `items` → `barcode`/`stockCode`/`sellerSku`/`productCode`, `productName`/`name`, `quantity`/`amount` |

Kalem durumu satır bazlı olabilir (`orderItems[].status`); paket kimliği
`packageNumber` yoksa sipariş numarası kullanılır (bölünmüş sipariş desteği
yok — **doğrulanmalı**).

### Durum kodları

| Kod / metin | Kanonik | Kaynak |
|---|---|---|
| `12` "Siparişiniz Hazırlanıyor" | Picking | wiensa README, beemmb sabiti |
| `5` "Siparişiniz Kargoya Verildi" | Shipped | wiensa README, beemmb sabiti |
| metin: "yeni", "onay" | Created | tahmin |
| metin: "hazırlan", "toplan" | Picking | tahmin |
| metin: "kargo" | Shipped | tahmin |
| metin: "teslim edildi" | Delivered | tahmin |
| metin: "iptal" | Cancelled | tahmin |
| metin: "iade" | Returned | tahmin |
| diğer sayılar | Created + uyarı | — |

## Ürün listeleme

`GET /product/products?Approved=true&Page=1&Size=100` (Bearer). Zarf `data[]`
(ya da `data.items`). Alanlar (**doğrulanmalı**): `code` (ürün kodu),
`barcode`, `name`/`displayName`, `brandName`, `categoryName`,
`images[]`/`imageUrls[]`, `stockCode`, `approved`.

## Yetenekler

`urun: true`, `etiket: false`, `azamiPencereGun: 14`, `sayfaArasiMs: 1000`
(60/dk sınırı), `ilkSenkronGun: 30`.

## Doğrulanacaklar

1. Sipariş yanıtı gerçek alan adları ve zarf.
2. Durum kodlarının tam listesi (12 ve 5 dışındakiler).
3. Gövde biçimi (form vs JSON) ve tarih biçimi kabulü.
4. Ürün ucu alanları; `Approved=false` de çekilmeli mi.
5. Hız sınırı ve 429 davranışı.
