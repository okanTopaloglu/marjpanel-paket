# MarjPanel Paket — Türkçe Anahtar Kelime ve İçerik Kümesi Planı

**Tarih:** 2026-09-20
**Yöntem notu:** Ücretli hacim/SERP API'sine erişimim yok. Aşağıdaki değerlendirmeler WebSearch ile yapılan manuel gözleme dayanır. Arama hacmi rakamı UYDURULMAMIŞTIR; bunun yerine niyet sınıflandırması ve gözlemlenen rekabet yoğunluğu (hangi domainlerin tekrar ettiği, içerik türü, marka gücü) üzerinden "kolay / orta / zor" etiketi verilmiştir.

---

## 1. İş Modeli ve Mimari Yaklaşım

MarjPanel Paket iki farklı arama niyeti grubuna hitap ediyor:

- **(A) HİZMET arayanlar** — "bana depo ve paketleme hizmeti verecek bir firma arıyorum" niyetiyle arama yapan e-ticaret satıcıları (3PL/fulfillment niyeti).
- **(B) YAZILIM arayanlar** — "pazaryerlerimi tek panelden yönetecek bir yazılım arıyorum" niyetiyle arama yapan satıcılar (SaaS/panel niyeti).

Bu ikisi aynı hedef kitleye ait olsa da farklı arama dili, farklı rakip seti ve farklı satın alma kararı sürecine sahip. Bu yüzden **tek anasayfa + iki alt-hub (pillar)** mimarisi öneriyorum:

- **Pillar 1 — Anasayfa:** Hizmet hub'ı (depo/paketleme/fulfillment niyeti)
- **Pillar 2 — /panel sayfası:** Yazılım hub'ı (SaaS/entegrasyon niyeti)

İki pillar karşılıklı link ile bağlanır: "Bu iş modelinin aynı altyapıdan geldiği" mesajı SEO açısından da marka tutarlılığı açısından da önemli.

---

## 2. Anahtar Kelime Grupları ve Niyet Sınıflandırması

### A. Hizmet (3PL/Fulfillment) tarafı

| Grup | Örnek kelimeler | Niyet | Rekabet |
|---|---|---|---|
| Temel tanım | fulfillment hizmeti, fulfillment nedir, 3PL nedir | Bilgi | **Zor** — OPLOG, ikas, Shopify TR gibi büyük markalar domine ediyor |
| Sağlayıcı seçimi | fulfillment firması nasıl seçilir, İstanbul fulfillment hizmeti, butik marka fulfillment hizmeti | Ticari | Orta — EcomMovers, Nice Lojistik gibi orta ölçekli oyuncular var ama boşluklar mevcut |
| Fiyatlandırma | paket başı ücretlendirme, kademeli fulfillment tarifesi, fulfillment maliyeti hesaplama | Ticari | **Kolay-Orta** — spesifik "paket başı" ifadesiyle doğrudan rakip içerik görülmedi |
| Operasyon süreci | e-ticaret mal kabul süreci, sipariş paketleme hizmeti, iade yönetimi | Bilgi/Ticari | Orta |

### B. Yazılım (SaaS/Panel) tarafı

| Grup | Örnek kelimeler | Niyet | Rekabet |
|---|---|---|---|
| Entegrasyon | pazaryeri entegrasyon programı, Trendyol Hepsiburada N11 entegrasyon yazılımı | Ticari | **Zor** — Dopigo, Nexsol/NParadox, Tamsoft, Proticaret, İDURUM çok güçlü |
| Niş entegrasyon | 6 pazaryerini (Pazarama + idefix dahil) tek panelden yönetim | Ticari | **Kolay** — bu 6'lı kombinasyonu birlikte işleyen içerik yok |
| Operasyon yazılımı | barkod ile paket doğrulama, çalışan performans takibi, stok takip | Bilgi/Ticari | Kolay-Orta — genel WMS içeriklerinde yüzeysel geçiyor, e-ticaret bağlamında derin işlenmemiş |
| Finans | hesap kesimi faturalama otomasyonu, pazaryeri sipariş faturalama | Ticari | Kolay-Orta |

**Navigasyonel kelimeler kümelemeden çıkarıldı:** "MarjPanel Paket", "MarjPanel giriş" gibi marka sorguları.

Tam liste (33 içerik anahtar kelimesi + 2 navigasyonel hariç) `seo/cluster-plan.json` dosyasındadır.

---

## 3. Rekabet Değerlendirmesi — Gerçekçi Öncelik Sıralaması

**Yeni bir sitenin gerçekten sıralanabileceği alanlar (yüksek öncelik):**
1. `paket-basi-ucretlendirme-nasil-calisir` — "paket başı ücretlendirme fulfillment" — doğrudan rakip yok
2. `6-pazaryeri-tek-panelden-yonetim` — Pazarama + idefix dahil 6 pazaryeri kombinasyonu — niş, boş alan
3. `kendi-depon-mu-fulfillment-mi` — karar/karşılaştırma sorgusu — düşük rekabet
4. `calisan-performans-takibi-depo-yazilimi` — neredeyse hiç içerik yok

**Orta vadede hedeflenebilir (orta rekabet, marka otoritesi biriktikçe):**
- İstanbul fulfillment hizmeti, fulfillment maliyeti hesaplama, e-ticaret mal kabul süreci, pazaryeri entegrasyonu nasıl seçilir

**Kısa vadede hedeflenmemesi önerilen (zor, büyük marka rekabeti):**
- "fulfillment nedir", "3PL nedir", "pazaryeri entegrasyon programı" (genel/jenerik hali) — bunlar yalnızca destekleyici iç bağlam/SSS içeriği olarak ele alınmalı, ayrı pillar/spoke olarak öncelik verilmemeli.

---

## 4. Hub-and-Spoke Mimarisi

```
Pillar 1: Anasayfa (/)                      Pillar 2: /panel
"e-ticaret fulfillment hizmeti"             "pazaryeri entegrasyon ve depo yönetim yazılımı"
  │                                              │
  ├─ Küme: Sağlayıcı Seçimi (3 spoke)            ├─ Küme: Entegrasyon (3 spoke)
  ├─ Küme: Fiyatlandırma (3 spoke)               └─ Küme: Yazılım Operasyon (3 spoke)
  └─ Küme: Operasyon Süreci (3 spoke)
        │                                              │
        └──────────────── karşılıklı link ─────────────┘
```

Toplam: 2 pillar + 5 küme + 15 spoke sayfa.

### Kümeler ve spoke'lar

**Pillar 1 altında:**
1. **Fulfillment Sağlayıcı Seçimi** — fulfillment-firmasi-nasil-secilir, istanbul-fulfillment-hizmeti, kendi-depon-mu-fulfillment-mi
2. **Fiyatlandırma ve Maliyet** — paket-basi-ucretlendirme-nasil-calisir, fulfillment-maliyeti-nasil-hesaplanir, e-ticaret-depolama-fiyatlari
3. **Depo Operasyon Süreçleri** — e-ticaret-mal-kabul-sureci, siparis-paketleme-hizmeti, e-ticaret-iade-yonetimi-depo-hizmeti

**Pillar 2 altında:**
4. **Pazaryeri Entegrasyonu** — 6-pazaryeri-tek-panelden-yonetim, pazaryeri-entegrasyonu-nasil-secilir, siparis-senkronizasyon-suresi-neden-onemli
5. **Depo Yazılımı: Barkod/Stok/Performans** — barkod-ile-paket-dogrulama-sistemi, calisan-performans-takibi-depo-yazilimi, pazaryeri-siparis-hesap-kesimi-faturalama

Her spoke, kendi pillar'ına zorunlu link verir/alır; küme içi spoke'lar birbirine "önerilen" link verir; kümeler arası bağlantılar "opsiyonel" olarak işaretlenmiştir. Tam adjacency listesi `cluster-plan.json` → `ic_link_matrisi` alanındadır. Hiçbir sayfa yetim (orphan) değildir; her sayfa en az 3 gelen link alır.

---

## 5. Anasayfa Önerisi (Pillar 1)

- **Title (47 karakter):** `MarjPanel Paket | E-Ticaret Depo ve Paketleme Hizmeti`
- **Meta description (148 karakter):** `E-ticaret siparişlerinizi biz depolayalım, paketleyelim, kargoya verelim. Kademeli paket başı ücretlendirme, şeffaf fiyatlandırma. Hemen teklif alın.`
- **H1:** `E-Ticaret Siparişlerinizi Depolayalım, Paketleyelim, Kargoya Verelim`
- **H2 hiyerarşisi:**
  1. MarjPanel Paket Nasıl Çalışır?
  2. Paket Başına Kademeli Ücretlendirme
  3. Mal Kabulden Kargoya: Operasyon Sürecimiz
  4. Neden MarjPanel Paket?
  5. Panelimizi Bağımsız Yazılım Olarak da Kullanabilirsiniz
  6. Sıkça Sorulan Sorular

**Not:** H1'de İngilizce "fulfillment" yerine Türkçe "depola, paketle, kargoya ver" tercih edildi — hedef kitlenin gerçek arama dili buna daha yakın görünüyor (arama sonuçlarında "fulfillment hizmeti" ile "depo ve paketleme hizmeti" ifadeleri iç içe kullanılıyor). "Fulfillment" terimi gövde metninde ve H2/SSS'de destekleyici terim olarak geçmeli, çünkü üst sıradaki rakipler bu terimi kullanıyor ve terimi bilen aramacılar da var.

## 6. Panel Sayfası Önerisi (Pillar 2)

- **Title (56 karakter):** `MarjPanel | Pazaryeri Entegrasyon ve Depo Yönetim Yazılımı`
- **Meta description (147 karakter):** `Trendyol, Hepsiburada, N11, Pazarama, idefix ve Amazon'u tek panelden yönetin. Barkodlu paket doğrulama, 30 saniyede sipariş senkronizasyonu.`
- **H1:** `6 Pazaryerini Tek Panelden Yönetin, Barkodla Paket Doğrulayın`
- **H2 hiyerarşisi:**
  1. Desteklenen Pazaryerleri
  2. 30 Saniyede Sipariş Senkronizasyonu
  3. Barkod ile Paket Doğrulama
  4. Stok ve Çalışan Performans Takibi
  5. Hesap Kesimi ve Faturalama
  6. Depo Hizmetimizle Birlikte veya Bağımsız Kullanın

---

## 7. Rakip Konumlandırma Özeti

| Firma | Tür | Konumlandırma |
|---|---|---|
| [OPLOG](https://www.oplog.io/tr/e-ticaret) | Fulfillment/3PL | Kurumsal, büyük ölçekli, "kullandığın kadar öde" mesajı, güçlü SEO otoritesi |
| [İdealDepo](https://idealdepo.com.tr/e-ticaret-fulfillment-hizmetleri/) | Fulfillment/3PL | KOBİ odaklı, çok sayıda tanım/rehber içeriğiyle geniş SEO ayak izi |
| [EcomMovers](https://www.ecommovers.com/) | Fulfillment/3PL | Butik markalara özel, şeffaf paket fiyatlandırma — MarjPanel'in paket başı modeline en yakın konumlanan rakip |
| [FulfillmentTR](https://fulfillmenttr.com/) | Fulfillment/3PL | Fiyatlandırma rehberleri ve "nasıl seçilir" içerikleriyle bilgi niyetli trafiği yakalıyor |
| [DHL Fulfillment](https://www.dhl.com/tr-tr/microsites/supply-chain/fulfillment-network/our-network/fulfillment-in-turkey.html) | Kurumsal 3PL | Büyük hacim (1500+ sipariş/ay) odaklı, KOBİ'nin doğrudan rakibi değil ama marka otoritesiyle SERP'te üstte |
| [Nice Lojistik](https://nicelojistik.com/) | Fulfillment/3PL | Lokal (İstanbul) hizmet sayfalarıyla şehir bazlı aramalarda görünür |
| [Dopigo](https://www.dopigo.com/pazaryeri-entegrasyonu/) | Pazaryeri entegrasyon yazılımı | Çok kanallı satış paneli, entegrasyon odaklı |
| [Nexsol / NParadox](https://nexsol.com.tr/) | Pazaryeri entegrasyon yazılımı | Kurumsal ERP + entegrasyon hibrit konumlandırma |
| [İDURUM](https://idurum.com/ozellikler/pazaryeri-entegrasyon) | Ön muhasebe + entegrasyon | Muhasebe yazılımına entegre, faturalama güçlü |
| [Proticaret](https://www.proticaret.org/pazaryerleri-entegrasyonu) / [Tamsoft](https://tamsoft.com.tr/pazaryeri-entegrasyonlari/) | Pazaryeri entegrasyon yazılımı | Kargo süreç yönetimi dahil geniş özellik seti |

### Boşluk analizi — MarjPanel'in fırsatı

1. **Hiçbir rakip hizmet + SaaS panelini aynı markada net biçimde birleştirmiyor.** MarjPanel'in en güçlü ayırt edici konumlandırması bu ikilik olmalı — "depomuzu kullanın veya sadece panelimizi kullanın" mesajı.
2. "Paket başı kademeli ücretlendirme" ifadesiyle doğrudan rakip içerik yok — hızlı kazanım.
3. Pazarama + idefix'i diğer 4 pazaryeriyle (Trendyol/Hepsiburada/N11/Amazon) birlikte işleyen içerik neredeyse yok — niş ama isabetli.
4. Barkod doğrulama + çalışan performansı e-ticaret bağlamında derin işlenmemiş.

---

## 8. Doğrulama Kontrol Listesi

- [x] Hiçbir iki sayfa aynı birincil anahtar kelimeyi hedeflemiyor
- [x] Her spoke en az 3 gelen link alıyor (pillar + 2 küme-içi/çapraz link)
- [x] Her spoke kendi pillar'ına link veriyor (zorunlu)
- [x] Her pillar kendi kümelerindeki tüm spoke'lara link veriyor (zorunlu)
- [x] Yetim sayfa yok
- [x] Şablon seçimi niyet sınıflandırmasıyla uyumlu (ticari → karşılaştırma/hizmet detay şablonu, bilgi → rehber şablonu)
- [x] Kelime sayısı hedefleri: pillar 2000-3500, spoke 1200-1800 aralığında
- [x] Toplam yapı: 2 pillar, 5 küme, 15 spoke (küme başına 3 post) — belirtilen 2-5 küme / 2-4 post aralığında
- [x] Navigasyonel kelimeler (marka sorguları) kümelemeden çıkarıldı

**Önemli sınırlama hatırlatması:** Bu planda verilen "kolay/orta/zor" rekabet etiketleri ve SERP gözlemleri, ücretli anahtar kelime hacmi veya sıralama zorluğu araçlarına dayanmamaktadır; WebSearch ile yapılan manuel gözleme dayalı niteliksel bir değerlendirmedir. Yayın öncesi gerçek hacim ve zorluk verisi için Google Search Console (yayın sonrası) veya ücretli bir SEO aracıyla (Ahrefs, Semrush, benzeri) doğrulama yapılması önerilir.

---

**Dosyalar:**
- `C:\Users\okant\marjpanel-paket\seo\cluster-plan.json` — tam yapılandırılmış veri (anahtar kelime seti, link matrisi, rakip listesi)
- `C:\Users\okant\marjpanel-paket\seo\cluster-plan.md` — bu özet
