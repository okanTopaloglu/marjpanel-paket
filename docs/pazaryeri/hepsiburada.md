# Hepsiburada — API notları (M6-B)

Kaynaklar (2026-09-19): `developers.hepsiburada.com` bot korumalı (403);
bilgiler oradan türetilmiş **Swagger 2.0 spec'i** (`taha-kanar/hepsiburada-sdk`
`openapi/order.json`, `catalog.json`) ve iki gerçek istemciden (aynı SDK'nın
README'si, `BoraBayraktar/beemmb`) alındı. "Doğrulanmalı" işaretli satırlar
canlı hesapla test edilene kadar varsayımdır.

## Kimlik doğrulama — üç alan

| Alan | Nereye gider | Not |
|---|---|---|
| `merchantId` (GUID) | URL yolu **ve** Basic auth **kullanıcı adı** | Satıcı panelindeki mağaza kimliği |
| `serviceKey` | Basic auth **şifre** | "Servis anahtarı" |
| `entegratorAdi` | `User-Agent` başlığı, **birebir** | Panelde kayıtlı entegratör adı. SDK README: "User-Agent bir kimlik bilgisidir; `{merchantId} - {ad}` gibi süslenmiş her varyant 401 alır" |

Üç hata da 401 verir ve hiçbiri "anahtar yanlış" değildir; kart ipucu bunu
söyler. `beemmb` istemcisi `apiKey:apiSecret` kullanıyor — iki kaynak çelişiyor;
README'nin uyarısı daha somut olduğu için **merchantId:serviceKey** seçildi
(**doğrulanmalı**; yanlışsa alan etiketleri değişir, kod değil).

## Taban adresler

- OMS: `https://oms-external.hepsiburada.com` (SIT: `oms-external-sit`)
- Katalog: `https://mpop.hepsiburada.com/product` (SIT: `mpop-sit`)
- `ayarlar.sandbox = true` SIT adreslerine çevirir.

## Sipariş / paket uçları (OMS, Swagger 2.0)

Hepsiburada'da sipariş **kalem** bazlıdır; kargo barkodu ancak kalemler
**paketlenince** doğar (`POST /packages/...`, panelde ya da otomatik
paketlemeyle). Depo yalnız paketle çalışabilir. Bu yüzden **v1'de yalnız
paketler çekilir**; paketlenmemiş (Open) kalemler panele düşmez.
Paket ↔ sipariş çoktan çoğadır (`OrderNumbers[]`, paket bölme); satır kimliği
**`packageNumber`**, `siparisNo` paketteki ilk sipariş numarasıdır.

| Uç | Sayfalama | Dönen |
|---|---|---|
| `GET /packages/merchantid/{id}?begindate&enddate&limit&Offset` | `limit` **en fazla 10**, `Offset` (büyük O, spec böyle) | **düz dizi** `ExternalRawPackageRepresentation[]` — zarf yok |
| `GET /orders/merchantid/{id}?begindate&enddate&limit&offset` | `limit` zorunlu, ≤100 | `{items: LineRepresentation[], limit, offset, pageCount, totalCount}` — Open kalemler (v1'de kullanılmıyor) |
| `GET /packages/merchantid/{id}/shipped` · `/delivered` · `/undelivered` | offset/limit ≤50 | yalnız Id/PackageNumber/Barcode/OrderNumbers/tarih — adres/kalem YOK |
| `GET /orders/merchantid/{id}/cancelled` | offset/limit ≤50 | iptal kalemler (orderNumber, lineItemId) |
| `GET /packages/merchantid/{id}/packagenumber/{no}` | — | paket kargo bilgisi |
| `GET /packages/.../packagenumber/{no}/labels?format=` | — | `{data[], format, hasMerchantMutualBarcode}` (v1 dışı) |

Tarih biçimi: `yyyy-MM-dd HH:mm` (**Türkiye saati**; ISO gönderen istemci "200
ama yanlış pencere" alıyor — SDK README). `begindate`/`enddate` **paketin
eklenme tarihine** göre süzer.

**Varsayım (doğrulanmalı):** `/packages` listesi durumdan bağımsız o pencerede
oluşturulmuş TÜM paketleri `status` alanıyla verir; kargoya verilen paketin
durumu burada "Shipped" olarak gelir. Gelmiyorsa `/shipped` ve `/delivered`
fazları eklenir ve motorun ince satırda `ham_veri`yi korumasını sağlayan bir
"yalnız durum" upsert modu gerekir.

### Paket alanları (`ExternalRawPackageRepresentation`)

`id`, `packageNumber`, `barcode` (= **kargo takip / okutulan**), `status`,
`cargoCompany`, `orderDate`, `dueDate`, `recipientName`, `customerName`,
`phoneNumber`, `shippingAddressDetail`, `shippingDistrict` (mahalle),
`shippingTown` (**ilçe**), `shippingCity` (il), `unpackedDate`,
`items[] { orderNumber, lineItemId, hbSku, merchantSku, productBarcode,
productName, quantity, … }`. Fatura/TCKN alanları ham yükte kalır, arayüze
inmez (`_normal` zarfı).

Kalem barkodu: `productBarcode || merchantSku || hbSku`.

### Durum eşlemesi (spec'te enum yok — **doğrulanmalı**)

| Ham | Kanonik |
|---|---|
| Open, Created | Created |
| Packaged, Picking, ReadyToShip, Prepared | Picking |
| Shipped, InTransit, Intransit | Shipped |
| Delivered | Delivered |
| Cancelled, Canceled, CancelledByMerchant, CancelledByHb | Cancelled |
| Unpacked | Cancelled (paket bozuldu; barkodu geçersiz) |
| Returned | Returned |
| UnDelivered, Undelivered | UnDelivered |

Tanınmayan → Created + tek uyarı logu (`lib/pazaryeri/durum.ts`).

## Ürün kataloğu (mpop)

`GET https://mpop.hepsiburada.com/product/api/products/all-products-of-merchant/{merchantId}?page&size`
Basic auth (spec `Basic`; SDK README "bazı servisler merchant id'yi başlıkta
ister" — **doğrulanmalı**). Yanıt zarfı:
`{ success, totalPages, totalElements, number, last, data: [...] }`;
`data[] { merchantSku, barcode, hbSku, productName, brand, images[],
categoryName, status }`. `size` üst sınırı belgede yok; 200 kullanılır.

## Yetenekler

`urun: true`, `etiket: false` (v1), `azamiPencereGun: 3` (limit 10 × motorun
100 sayfa sınırı = pencere başına ≤1000 paket), `sayfaArasiMs: 300`,
`ilkSenkronGun: 30`.

## Doğrulanacaklar

1. Basic auth kullanıcı adı gerçekten merchantId mi (yoksa ayrı API key mi).
2. `/packages` kargoya verilmiş/teslim paketleri de listeliyor mu.
3. `status` değerlerinin tam kümesi.
4. mpop katalog ucunun kimlik doğrulaması ve `size` sınırı.
5. 429'da `Retry-After` var mı.
