/**
 * TANITIM SAYFASI İÇERİĞİ — tek kaynak.
 *
 * Metin JSX'ten AYRI durur çünkü aynı cümleler üç yerde kullanılır: sayfanın
 * kendisi, JSON-LD yapılandırılmış verisi (FAQPage, Service) ve llms.txt.
 * Üçü ayrı yazılsaydı biri güncellenince diğerleri sessizce eskir; arama
 * motoru da yapılandırılmış veri ile görünen metin çeliştiğinde yapılandırılmış
 * veriyi yok sayar.
 *
 * YAZIM KURALI (DESIGN.md "Metin kuralları" + GEO): em-dash yok, emoji yok,
 * her paragraf TEK BAŞINA anlaşılır. AI arama motorları pasaj düzeyinde
 * alıntılar; bağlama muhtaç cümle alıntılanmaz.
 *
 * DÜRÜSTLÜK: buradaki hiçbir sayı uydurma değildir. Ücret, müşteri sayısı ve
 * referans YOKTUR çünkü gerçek veri yok. Uydurma sosyal kanıt hem yanıltıcı
 * olur hem de ilk müşteri görüşmesinde çöker.
 */

export const SITE_ADI = "MarjPanel Paket";
export const SITE_URL = "https://paket.marjpanel.com";

/**
 * Arama sonucunda görünen başlık. 60 karakter sınırına uyar.
 *
 * "Fulfillment" DEĞİL "depo ve paketleme": hedef kitlenin arama dili Türkçe.
 * Terimi bilen aramacı için "fulfillment" gövde metninde ve SSS'te geçer.
 */
export const META_BASLIK = "E-Ticaret Depo ve Paketleme Hizmeti | MarjPanel Paket";

/** Meta açıklama. 155 karakter sınırına uyar, eylem çağrısıyla biter. */
export const META_ACIKLAMA =
  "Siparişlerinizi biz depolayıp paketleyelim, kargoya verelim. Ya da paneli kendi deponuzda kullanın: 6 pazaryeri, barkodla paket doğrulama. Teklif alın.";

export const H1 = "Siparişlerinizi depolayalım, paketleyelim, kargoya verelim";

export const GIRIS_METNI =
  "MarjPanel Paket iki şekilde çalışır. Ürünlerinizi depomuza gönderirsiniz, siparişleri biz paketler ve kargoya veririz; paket başına ödersiniz, depo kirası ve personel maaşı ödemezsiniz. Ya da aynı paneli kendi deponuzda kullanırsınız, ekibiniz barkod okutarak sipariş hazırlar. Her iki durumda da Trendyol, Hepsiburada, N11, Pazarama, idefix ve Amazon siparişleri tek ekranda toplanır.";

/**
 * FARKLILAŞMA — araştırmanın en net bulgusu: incelenen rakiplerin hiçbiri
 * (fulfillment firmaları ve pazaryeri entegrasyon yazılımları) aynı markada
 * hem fiziksel depo hizmetini hem bağımsız kullanılabilen paneli sunmuyor.
 * Sayfanın en değerli cümlesi bu; ayrı bir bölüm olarak durur.
 */
export const FARK_BASLIK = "Hizmeti de yazılımı da aynı yerden alırsınız";
export const FARK_METNI =
  "Fulfillment firmaları size depo hizmeti verir ama yazılımlarını dışarıya açmaz. Entegrasyon yazılımları panel satar ama paketlemenizi yapmaz. MarjPanel Paket ikisini aynı sistemde sunar: bugün hizmetle başlayıp yarın kendi deponuza geçerseniz veriniz, geçmişiniz ve alışkanlıklarınız yerinde kalır.";

export interface Hizmet {
  baslik: string;
  ozet: string;
  maddeler: string[];
}

/** İki iş modeli. Sayfada yan yana iki kart; JSON-LD'de iki ayrı Service. */
export const HIZMETLER: readonly Hizmet[] = [
  {
    baslik: "Depo ve paketleme hizmeti",
    ozet:
      "Ürünlerinizi depomuza gönderirsiniz. Mal kabulünü yapar, siparişleri paketler, kargoya veririz. Paket başına ödersiniz, depo kirası ve personel maaşı ödemezsiniz.",
    maddeler: [
      "Mal kabul: gelen ürün adetlenir, irsaliye numarasıyla kaydedilir",
      "Stok takibi: kalan adet, günlük tüketim hızı ve tükenme tahmini",
      "Paketleme: sipariş içeriği barkodla doğrulanır, yanlış ürün çıkmaz",
      "Kargo: siparişler kesim saatine kadar hazırlanıp aynı gün verilir",
      "Faturalama: paket başına kademeli tarife, ek hizmetler ayrı kalem",
    ],
  },
  {
    baslik: "Kendi deponuz için panel",
    ozet:
      "Deposu ve ekibi olan satıcılar paneli doğrudan kullanır. Siparişler pazaryerlerinden otomatik iner, ekibiniz barkod okutarak hazırlar.",
    maddeler: [
      "Barkod okutma: kargo etiketi okutulur, sipariş anında hazır işaretlenir",
      "Üç okutma modu: hızlı, içerik gösteren rehberli ve atamalı toplama",
      "Çalışan takibi: kim kaç paket hazırladı, hangi saatler yoğun",
      "Kendi alan adınız: sirketiniz.marjpanel.com, kendi logonuzla",
      "Yetki ayrımı: yönetici, çalışan ve şirket sahibi farklı ekran görür",
    ],
  },
] as const;

export interface Ozellik {
  baslik: string;
  metin: string;
}

/**
 * Ürünün gerçek farkları. Hepsi kodda KARŞILIĞI OLAN iddialardır
 * (bkz. graphify-out/memory/*.md): 30 saniyelik senkron, geniş tarama,
 * mükerrer okutma perdesi, kuruş tam sayı finans.
 */
export const OZELLIKLER: readonly Ozellik[] = [
  {
    baslik: "Siparişler 30 saniyede bir kontrol edilir",
    metin:
      "Yeni siparişler pazaryerlerinden 30 saniyede bir çekilir. Ayrıca 15 dakikada bir son 7 gün yeniden taranır, böylece eski siparişlerin kargoya verildi ya da iptal edildi bilgisi de güncel kalır.",
  },
  {
    baslik: "Altı pazaryeri, tek ekran",
    metin:
      "Trendyol, Hepsiburada, N11, Pazarama, idefix ve Amazon siparişleri aynı listeye iner. Her pazaryerinin kendi durum kodları ortak bir dile çevrilir; hangi siparişin hangi aşamada olduğunu tek yerden görürsünüz.",
  },
  {
    baslik: "Yanlış paket çıkmaz",
    metin:
      "Aynı barkod ikinci kez okutulduğunda ekran durur ve uyarır. Kargoya verilmiş ya da iptal olmuş sipariş okutulduğunda da öyle. Rehberli modda paketleyen kişi siparişin içindeki ürünleri ve adetleri ekranda görür.",
  },
  {
    baslik: "Kargoya verilmesi gereken sipariş sayısı her an ortada",
    metin:
      "Kesim saatinizi siz belirlersiniz. O saate kadar gelen ve henüz çıkmamış siparişler ana ekranda ayrı bir sayaçta durur; dünden kalanlar da bu sayacın içindedir.",
  },
  {
    baslik: "Telefonla da okutulur",
    metin:
      "El terminali yoksa telefonun kamerası barkod okuyucu olarak kullanılır. Panel telefona uygulama gibi kurulabilir, internet kesildiğinde son ekran açık kalır.",
  },
  {
    baslik: "Hesap kesimi tahmine dayanmaz",
    metin:
      "Dönem sonunda kaç paket hazırlandıysa tarifedeki kademelere göre hesaplanır. Ek hizmetler ayrı kalem olarak görünür, KDV ayrı hesaplanır. Şirket sahibi kendi borcunu ve ödemelerini kendi ekranından görür.",
  },
] as const;

export interface Adim {
  baslik: string;
  metin: string;
}

/** "Nasıl çalışır" akışı. JSON-LD'de HowTo olarak da verilebilir. */
export const ADIMLAR: readonly Adim[] = [
  {
    baslik: "Mağazanızı bağlayın",
    metin:
      "Pazaryeri satıcı panelinizden aldığınız API bilgilerini girersiniz. Siparişler birkaç dakika içinde listeye düşmeye başlar.",
  },
  {
    baslik: "Ürünlerinizi gönderin ya da kendi deponuzu kullanın",
    metin:
      "Hizmet modelinde ürünler depomuza gelir ve mal kabulü yapılır. Panel modelinde bu adım atlanır, doğrudan okutmaya geçilir.",
  },
  {
    baslik: "Barkodu okutun",
    metin:
      "Kargo etiketi okutulur, sistem siparişi bulur ve hazır işaretler. Okutan kişi, saat ve kaynak kaydedilir.",
  },
  {
    baslik: "Kargoya verin",
    metin:
      "Hazırlanan paketler kargoya teslim edilir. Pazaryeri kargoya verildi bilgisini gönderdiğinde sipariş otomatik kapanır.",
  },
] as const;

export interface SSS {
  soru: string;
  cevap: string;
}

/**
 * SSS — hem sayfada hem FAQPage JSON-LD'sinde. Cevaplar TEK BAŞINA
 * anlaşılır ve kısa tutulur: AI arama motorları bu pasajları doğrudan
 * alıntılar, bağlama muhtaç cevap alıntılanmaz.
 */
export const SSS_LISTESI: readonly SSS[] = [
  {
    soru: "Depo hizmeti ile panel arasındaki fark nedir?",
    cevap:
      "Depo hizmetinde ürünlerinizi bize gönderirsiniz, paketlemeyi ve kargoya vermeyi biz yaparız, paket başına ödersiniz. Panelde ise işi kendi deponuzda kendi ekibinizle yaparsınız, biz yalnız yazılımı veririz.",
  },
  {
    soru: "Fulfillment hizmeti mi veriyorsunuz?",
    cevap:
      "Evet. Fulfillment, ürünlerin depolanması, siparişlerin paketlenmesi ve kargoya verilmesi işinin bir firmaya devredilmesidir. MarjPanel Paket bu hizmeti verir ve farklı olarak aynı işi kendi deponuzda yapmak isterseniz kullandığımız paneli size de açar.",
  },
  {
    soru: "Hangi pazaryerleri destekleniyor?",
    cevap:
      "Trendyol, Hepsiburada, N11, Pazarama, idefix ve Amazon. Altı pazaryerinin siparişleri aynı ekranda toplanır ve durum kodları ortak bir dile çevrilir.",
  },
  {
    soru: "Siparişler ne sıklıkla güncelleniyor?",
    cevap:
      "Yeni siparişler 30 saniyede bir çekilir. Eski siparişlerin durumu için 15 dakikada bir son 7 gün yeniden taranır.",
  },
  {
    soru: "Barkod okutmak için ne gerekiyor?",
    cevap:
      "El terminali ya da USB barkod okuyucu çalışır. Cihazınız yoksa telefonun kamerası da kullanılabilir; panel telefona uygulama gibi kurulabilir.",
  },
  {
    soru: "Aynı paket iki kez okutulursa ne olur?",
    cevap:
      "Ekran durur ve uyarı verir. Kargoya verilmiş ya da iptal edilmiş bir sipariş okutulduğunda da aynı uyarı çıkar, böylece yanlış paket kargoya gitmez.",
  },
  {
    soru: "Ücretlendirme nasıl çalışıyor?",
    cevap:
      "Depo hizmetinde paket başına ücret alınır ve tarife kademelidir: aylık paket adediniz arttıkça birim fiyat düşer. Ek hizmetler ayrı kalem olarak faturaya girer. Güncel fiyat için teklif isteyin.",
  },
  {
    soru: "Kendi markamla kullanabilir miyim?",
    cevap:
      "Evet. Şirketiniz kendi alt alan adıyla giriş yapar ve panelde kendi logonuz görünür. Altyapının MarjPanel Paket olduğu bilgisi imza düzeyinde kalır.",
  },
  {
    soru: "Verilerim başka şirketlerle karışır mı?",
    cevap:
      "Hayır. Her şirketin siparişi, stoğu ve kullanıcısı kendi kaydına bağlıdır ve sorgular şirket kimliğiyle sınırlandırılır. Çalışanlar yalnız kendi şirketinin verisini görür.",
  },
] as const;

/** Sayfadaki pazaryeri şeridi; ad ve renk tek kaynaktan (lib/pazaryeri/kayit). */
export const PAZARYERI_SIRASI_TANITIM = [
  "trendyol",
  "hepsiburada",
  "n11",
  "pazarama",
  "idefix",
  "amazon",
] as const;
