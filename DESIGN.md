# Design

Bu belge MarjPanel'in tasarım sisteminin MarjPanel Paket'e uyarlanmış
kopyasıdır.

MarjPanel panel arayüzünün tasarım sistemi: **Mürekkep & Nane**.

Bu belge PANELİ tanımlar. MarjPanel Paket'te herkese açık/pazarlama katmanı
yok; uygulama tek katman olarak bu sistemi kullanır, `globals.css` içinde
ayrı bir "HERKESE AÇIK YÜZEYLER" bölümü, `--site-*` token'ı ya da Geist yazı
tipi bulunmaz.

## Okuma

**Mod: Operate.** Kullanıcı bir işin içindedir - sipariş karşılar, fiyat
günceller, kâr kontrol eder. Arayüz işin önüne geçmez; tanıdık olmak burada
bir erdemdir, sürpriz değil.

**Dil:** sakin finans/defter hissi. Kesin bilgi tasarımı: sayı hizalı, satır
okunur, durum tek bakışta belli. Marka ayrıntıda yaşar - nane vurgusu, mürekkep
menü - sayfayı kaplamaz.

**Ölçekler:** VARIANCE 4 / MOTION 4 / DENSITY 6. Yoğunluk yüksek çünkü satıcı
çok satır görmek ister; hareket ölçülü çünkü kullanıcı akış içindedir.

## Tema

**Tek açık tema.** Koyu tema kaldırıldı. Gerekçe kullanım sahnesinden gelir:
satıcı gündüz, ofis ya da depo ışığında, çoğu zaman beyaz kâğıt ve pazaryeri
panelleriyle yan yana çalışır. İki temayı doğru tutmanın maliyeti, hiç
istenmemiş bir seçeneğe harcanıyordu.

## Renk

Strateji: **Restrained** - nötr zemin, tek vurgu rengi. Vurgu yalnız birincil
eylem, seçili durum ve durum göstergesinde; dekorasyonda asla.

### Zemin ve metin

| Rol | Değer | Kullanım |
|---|---|---|
| Zemin | `#F5F7F6` | Sayfa zemini. Düz - gradyan, grain, blur yok. |
| Yüzey | `#FFFFFF` | Kart, panel, tablo. |
| Metin | `#0F1B2D` | Gövde ve başlık. |
| İkincil metin | `#5C6878` | Etiket, açıklama, pasif durum. |
| Çizgi | `#DFE4E8` | Kenar, ayraç, tablo satırı. |
| Giriş kenarı | `#CBD3DA` | Form alanı kenarı (çizgiden bir kademe koyu). |

### Mürekkep (menü ve marka)

| Rol | Değer |
|---|---|
| Mürekkep | `#0F1B2D` |
| Mürekkep aktif | `#1B2B44` |
| Mürekkep metin | `#EAF0F6` (pasif maddede %72 opak) |

### Vurgu (nane)

| Rol | Değer | Kullanım |
|---|---|---|
| Vurgu | `#0F8A5F` | Birincil dolgu; beyaz metinle AA geçer. |
| Vurgu parlak | `#12A874` | İkon, odak halkası, aktif çubuk. |
| Vurgu açık | `#E4F5EE` | Soluk zemin. |
| Vurgu metin | `#0B6E4B` | Küçük metin (AA için koyulaştırılmış). |

### Durum

| Durum | Renk | Soluk zemin |
|---|---|---|
| Başarı | `#0F8A5F` | `#E1F4EB` |
| Uyarı | `#B8740A` | `#FCF1DA` |
| Hata | `#C63D36` | `#FBE6E4` |
| Bilgi | `#2F6FA8` | `#E4EEF8` |
| Bilinmiyor | `#5C6878` | `#EEF1F3` |

Kâr pozitif = başarı yeşili, negatif = hata kırmızısı. Her yerde aynı.

### Pazaryeri kimlikleri

Rozet çerçevesi ve metni rengi taşır; **dolgu yok** - dolu renk satırda
gürültü yapar ve tablo taramasını bozar.

Trendyol `#E85D2A` · Hepsiburada `#E0862F` · N11 `#7B3FA0` ·
Pazarama `#1E6FD9` · idefix `#0E8C9B` · PTT `#C8102E` · Amazon `#1A1A1A` ·
WooCommerce `#7F54B3`

Pazaryeri adı ve rengi tek kaynaktan gelir: `src/lib/pazaryeri/kayit.ts`
(`PazaryeriRozeti` oradan okur). idefix turkuazı öneridir; gerçek marka
rengi doğrulanmalı.

### Müşteri markası: MAMA AURA

Bu kurulum MAMA AURA'nın depo ekibi için ayakta; panel onların paneli gibi
okunmalı. Kimlik `src/components/marka/mama-aura.tsx` içinde toplanır:

| Öğe | Nerede | Biçim |
|---|---|---|
| Kelime işareti (açık) | Giriş kartı üstü, mobil üst çubuk, çevrimdışı sayfa, OG kartı | `public/marka/mamaaura.png` - resmi logo, kırpılmış |
| Kelime işareti (koyu) | Mürekkep menü, mobil çekmece | `mamaaura-koyu.png` - harfler `#EAF0F6`, kırmızı aynı |
| İşaret (ters üçgen) | Dar menü, "ana ekrana ekle", uygulama simgesi, favicon | Satır içi SVG; `scripts/gen-icons.mjs` aynı yolu kullanır |
| Filigran | Her panel sayfasının altı (`PanelAltBilgi`), boş durumlar, panel hata kartı | Kelime işareti gri tonda %40 — kırmızı yok, içerikle yarışmaz |

Marka kırmızısı `#D81040` **yalnız işaretin ve kelime işaretinin içinde**
yaşar; "Paket" hapı onun soluk tonunu alır. Buton, seçili satır, odak halkası,
durum rengi nane kalır. Pazaryeri rozetleriyle aynı ilke: kimlik rengi taşır,
dolgu almaz. MarjPanel altyapı olarak giriş alt bilgisinde ve OG kartının
köşesinde küçük bir notla anılır; iki marka aynı ağırlıkta yan yana durmaz.

Kaynak logo `scripts/marka/mamaaura-logo.png`; türevler `pnpm ikon:uret` ile
üretilir (`gen-marka.mjs` → `gen-icons.mjs` → `gen-og.mjs`).

### Yasaklar

Mor gradyan, cam efekti (`backdrop-blur`), neon glow, gradyan metin, saf
siyah. Vurgu rengi tektir - ikinci bir marka rengi icat edilmez; müşteri
markasının kırmızısı vurgu değil kimliktir (yukarı bakın).

## Geometri

**Tek köşe ölçeği:**

| Öğe | Yarıçap |
|---|---|
| Kart, panel | 12px |
| Buton, giriş, çip yuvası | 9px |
| Rozet, hap, çip | 999px |
| Sheet (üst köşeler) | 16px |

**Tek gölge kademesi:**

```
0 1px 2px rgb(15 27 45 / .06), 0 4px 12px -4px rgb(15 27 45 / .08)
```

Yalnız kaldırılan ya da etkileşimli yüzeyde. Zemine yapışık öğe gölge almaz.

## Tipografi

**Manrope Variable**, tek aile. `@fontsource-variable/manrope` paketinden -
`next/font/google` kullanılmaz (Docker ağsız derlenir).

Manrope ince görünür: **gövde ağırlığı 500**, başlıklar 700/800, başlık
tracking -0.02em.

**Rakamlar her yerde `tabular-nums`** - para sütunu zıplamaz.

| Sınıf | Boyut | Ağırlık | Kullanım |
|---|---|---|---|
| `.text-display` | 30-44px akışkan | 800 | Nadir; büyük sayı anı. |
| `.text-title-1` / `.page-title` | 22-30px akışkan | 700 | Sayfa başlığı. |
| `.text-title-2` | 20px | 700 | Bölüm başlığı. |
| `.text-title-3` | 17px | 600 | Kart başlığı. |
| `.text-headline` | 15px | 600 | Satır içi vurgulu metin. |
| `.text-body` | 15px | 500 | Gövde. |
| `.text-callout` | 14px | 500 | Tablo hücresi, menü maddesi. |
| `.text-footnote` | 13px | 500 | Açıklama. |
| `.text-caption` | 12px | 500 | Küçük etiket. |
| `.text-overline` | 11px, .06em, uppercase | 600 | Tablo başlığı, grup başlığı. |

`.page-subtitle`: 14px, ikincil metin, tek cümle.

Ölçek sabit rem (akışkan clamp yalnız iki büyük adımda) - ürün arayüzünde
kullanıcı sabit DPI'da bakar.

## Hareket

Emil Kowalski ilkeleri. **framer-motion yok** - hareket CSS'te yaşar.

- Yalnız `transform` ve `opacity` canlandırılır. `transition: all` yasak.
- Süreler: **120ms** dokunma geri bildirimi, **200ms** UI geçişi,
  **320ms** sheet/yüzey.
- Eğri: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. Çıkış girişten hızlı.
- Basma: `:active { transform: scale(.97) }` (`.press`).
- Giriş: `@starting-style` ile `opacity: 0` + `translateY(6px)` ya da
  `scale(.97)`. Asla `scale(0)`.
- Hover yalnız `@media (hover: hover) and (pointer: fine)`.
- Liste kademesi `.stagger`: `animation-delay: calc(var(--i, 0) * 40ms)`,
  en fazla 8 öğe.
- Klavye tetikli hareket yok: `:focus-visible:active { transform: none }`.
- `prefers-reduced-motion: reduce` - hareket kapanır, opaklık kalır.

## Kabuk

**Masaüstü:**

- Sol menü 240px, mürekkep zemin (`#0F1B2D`). Üstte wordmark (nane kare
  işaret + "MarjPanel" yanında küçük "Paket" etiketi), lucide ikonlu
  maddeler, altta hesap/ayarlar.
- Aktif madde: `#1B2B44` hap + solda 3px nane çubuk.
- Üst çubuk 56px, beyaz, ince alt çizgi. İçinde yalnız senkron durumu,
  bildirim zili, kullanıcı menüsü. **Sayfa başlığı üst çubukta değil,
  sayfada** - başlık içeriğin parçasıdır.

**Mobil:**

- Alt sekme çubuğu, 5 madde: Özet, Okut, Paketler, Siparişler, Menü.
  Beyaz zemin, üst çizgi, aktif madde nane ikon + etiket, hedef ≥44px.
- "Menü" alttan sheet açar (320ms, `@starting-style`).

**Şeritler:** deneme şeridi bilgi tonunda, vekâlet şeridi kırmızı (güvenlik
şartı - vekâlet kırmızı kazanır kuralı korunur).

## Bileşen sözlüğü

**Buton varyantları:** `default` (nane dolgu, beyaz metin), `ink` (mürekkep
dolgu), `outline`, `ghost`, `destructive`, `link`.
**Boyutlar:** `sm` (32px), `md` (36px), `lg` (44px), `icon`.
Her butonda `:active { scale(.97) }`.

**Tablo:** başlık 11px uppercase tracking .06em ikincil metin; satır 1px
çizgi; hover zemin `#F5F7F6`; sayısal hücreler tabular ve sağa hizalı.

**Ortak bileşenler:**

- `SayfaBasligi` - başlık + tek cümle açıklama + sağda aksiyonlar (mobilde
  aksiyonlar altta tam genişlik).
- `FiltreCubugu` - arama + aktif filtre çipleri + "Filtrele (N)". Masaüstünde
  popover, mobilde bottom sheet. URL senkronu bileşenin dışında.
- `BosDurum` - ikon + başlık + açıklama + aksiyon. Arayüzü öğretir, "kayıt
  yok" demez.
- `BilgiIpucu` - küçük "?" ikonu, dokununca/hover popover. E-ticaret
  müşterisine dönük açıklamalar için.

**Durumlar:** her etkileşimli bileşen default / hover / focus / active /
disabled / loading taşır. Yükleme iskeletle gösterilir, ortada dönen çarkla
değil.

## Metin kuralları

- Em-dash (—) ve en-dash (–) yok; kısa çizgi kullanılır.
- Dekoratif nokta yok.
- Emoji yok.
- İkonlar lucide-react'tan; el yapımı SVG yok.
- Kontrol kendi eylemini adlandırır; hata mesajı sorunu ve çözümü söyler.

## Korunan yardımcı sınıflar

Aşağıdaki sınıf adları eski "Sıcak Kum" sisteminden KORUNDU ve yeni dile göre
yeniden tanımlandı. Adlar aynı kaldı çünkü panel genelinde yüzlerce tüketici
var ve bu faz sayfaları yeniden yazmıyor:

`.glass` (artık opak beyaz + ince çizgi), `.material` / `.material-thin` /
`.material-thick` / `.material-edge` (opak yüzeyler), `.scroll-edge`,
`.lift`, `.press`, `.kontrol-yuva`, `.kontrol-yuva-sarmal`, `.kontrol-hap`,
`.kontrol-alan`, `.rozet`, `.vurgu`, `.grad-text` (düz vurgu rengi),
`.skeleton`, `.segment`, `.shadow-soft` / `.shadow-soft-lg` /
`.shadow-soft-xl` (tek gölge kademesine düşer), `.bg-grad-primary` /
`.bg-grad-cta` / `.bg-grad-surface` (düz dolgu), `.tabular`, `.no-scrollbar`,
`.pt-safe` / `.pb-safe` / `.pl-safe` / `.pr-safe` / `.px-safe` / `.mb-safe` /
`.inset-safe-b`, `.snap-x-strip`, `.will-move`, `.kademe`, `.stagger`,
`.animate-in`, `.animate-fade`, `.animate-materialize`, `.animate-sheet`,
tipografi ölçeği (`.text-display` … `.text-overline`, `.page-title`,
`.page-subtitle`).
