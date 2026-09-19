# idefix — API notları (M6-C)

Kaynak: `developer.idefix.com` (2026-09-19'da okundu; site açık, belge
Türkçe ve ayrıntılı).

## Kimlik doğrulama

- Satıcı paneli → Hesap Ayarları → Entegrasyon Bilgileri → "Yeni API oluştur";
  API KEY ve API SECRET e-postayla gelir. Vendor ID de aynı sayfada.
- Her isteğe başlık: **`X-API-KEY: base64(apiKey:apiSecret)`** ("VENDOR TOKEN").
  Hatalı jeton → `401 VENDOR_TOKEN_NOT_EXIST`.
- Vendor ID URL yolundadır (`/oms/{vendorId}/list`).
- Canlı: `https://merchantapi.idefix.com` (IP beyaz listesi yok).
  Test (stage): `https://ide-omsapi.idefiks.net`, `https://ide-pimapi.idefiks.net`
  — IP beyaz listesi ve idefix desteğinden test hesabı ister; canlı ve test
  anahtarları farklıdır. `ayarlar.sandbox` v1'de desteklenmiyor.

## Sipariş (sevkiyat) listeleme

`GET https://merchantapi.idefix.com/oms/{vendorId}/list`

| Parametre | Not |
|---|---|
| `startDate` / `endDate` | **`yyyy/MM/dd HH:mm:ss`** (Türkiye saati) |
| `lastUpdatedAt` | son güncellemeye göre |
| `state` | sevkiyat durumu |
| `ids`, `orderNumber` | tekil arama |
| `page` | **1 tabanlı**, varsayılan 1 |
| `limit` | varsayılan 10; üst sınır belgede yok → 50 kullanılır (**doğrulanmalı**) |
| `sortByField` / `sortDirection` | `updatedAt` / `asc` |

Zarf: `{ totalCount, itemCount, pageCount, currentPage, limit, items[] }`.

Sevkiyat alanları: `id` (sevkiyat = **paket kimliği**), `orderNumber`,
`status`, `statusDescription`, `statusUpdatedAt`, `orderDate`, `createdAt`,
`updatedAt`, `cargoCompany`, `cargoTrackingNumber`, `cargoTrackingUrl`,
`customerContactName`, `customerContactMail`, `customerTcNumber`,
`shippingAddress { firstName, lastName, address1, city, county (ilçe),
neighborhood, postalCode, phone, floor, buildingNumber, doorNumber }`,
`items[] { productName, barcode, merchantSku, erpId, brandName, itemStatus,
price, quantity? }` — `quantity` alanı belgede listelenmiyor; yoksa 1 sayılır
(**doğrulanmalı**: kalemler adet başına ayrı satır mı).

### Durum eşlemesi (belgeden)

| idefix | Anlamı | Kanonik |
|---|---|---|
| `created` | ödeme başarılı, toplama hazır değil | Created |
| `shipment_ready` | hazırlanmaya başlanabilir | Created |
| `shipment_picking` | toplama başladı, iptal edilemez | Picking |
| `shipment_invoiced` | fatura kesildi | Invoiced |
| `shipment_split` | parçalı işlem | Picking |
| `shipment_in_cargo` | kargoya verildi | Shipped |
| `shipment_delivered` | teslim edildi | Delivered |
| `shipment_approved` | tüm süreç tamam | Delivered |
| `shipment_undeliver` | teslim edilemedi | UnDelivered |
| `shipment_cancelled` | müşteri iptal | Cancelled |
| `shipment_unsupplied` | temin edilemedi | UnSupplied |

## Ürün listeleme

`GET https://merchantapi.idefix.com/pim/pool/{vendorId}/list?page&limit[&barcode&state]`
— "sayfalama zorunlu". Zarf `{ products: [...] }` (toplam/sayfa alanları
**doğrulanmalı**; boş sayfa bitiş sayılır). Ürün: `barcode`, `title`,
`productMainId`, `brandId`, `categoryId`, `images[]` (URL dizisi),
`status` (`not_matched` gibi), `inventoryQuantity`, `price`.
Marka/kategori yalnız id → `marka: null`, `kategori: null`.

## Eşleme kararları

- `siparisKimligi = id` (sevkiyat), `siparisNo = orderNumber`,
  `kargoTakipNo = cargoTrackingNumber`, `kargoFirmasi = cargoCompany`.
- Müşteri adı `shippingAddress.firstName + lastName`, yoksa `customerContactName`.
- Kalem barkodu `barcode || merchantSku || erpId`.
- Pencere 14 gün (azami aralık belgede yok), sayfa arası 300 ms.

## Doğrulanacaklar

1. `X-API-KEY` başlık adının birebir yazımı (belge "X-API-KEY" diyor).
2. `limit` üst sınırı; `items[].quantity` var mı.
3. `startDate/endDate` azami aralık; 429 davranışı.
