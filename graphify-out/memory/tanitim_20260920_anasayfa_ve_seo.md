---
type: "architecture"
date: "2026-09-20T00:00:00+00:00"
question: "Herkese acik tanitim sayfasi nerede yasar ve SEO altyapisi nasil kurulu?"
contributor: "graphify"
source_nodes: ["TanitimSayfasi()", "yapilandirilmisVeri()", "robots()", "sitemap()", "acikYolMu()", "platformHostuMu()"]
---

# Q: Herkese acik tanitim sayfasi nerede yasar ve SEO altyapisi nasil kurulu?

## Answer

2026-09-20'de eklendi (commit 17ae31c + 988eb47). Oncesinde MarjPanel Paket'in
herkese acik hicbir sayfasi yoktu; kok yol dogrudan /giris'e yonlendiriyordu.

KOK YOL CATALI (middleware.ts):
Oturumsuz ziyaretci "/" isteginde `/tanitim`'a REWRITE edilir (redirect DEGIL).
Adres cubugunda ve arama sonucunda kok URL kalir; 301/302 ile /tanitim'a
atilsaydi kanonik adres ikiye bolunurdu. Girisli kullanici kokte paneli gorur.
`ACIK_YOLLAR` artik `{"/", "/tanitim", "/giris", "/kayit"}`; `authorized()`
icinde kok YOL ISTISNADIR (girisliyi "/"a yonlendirmek sonsuz dongu olurdu).
Kiraci host'unda tanitim GOSTERILMEZ: sayfa kendi icinde `platformHostuMu`
kontrolu yapip /giris'e yonlendirir (Edge middleware DB'ye bakamaz).

DOSYALAR:
- `src/app/(site)/tanitim/page.tsx` - sunucu bileseni, ISTEMCI JS YOK.
  SSS `<details>` ile acilir (tarayicinin kendi isi). Panelle AYNI tasarim
  sistemi; ayri site temasi/token/yazi tipi yok.
- `src/app/(site)/tanitim/icerik.ts` - TUM METIN TEK KAYNAK. Sayfa, JSON-LD ve
  llms.txt ayni sabitleri okur; ayri yazilsaydi biri guncellenince digerleri
  sessizce eskirdi.
- `src/app/(site)/tanitim/yapilandirilmis-veri.ts` - tek `@graph` JSON-LD:
  Organization, WebSite, WebPage, Service (depo), SoftwareApplication (panel),
  FAQPage, ItemList.
- `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/llms.txt/route.ts` -
  hepsi HOST DUYARLI, `force-dynamic`.

KRITIK TUZAK (bulundu ve duzeltildi): `robots.txt` ve `sitemap.xml`
middleware matcher'inda MUAF DEGILDI. Muaf olmasaydi oturumsuz istek /giris'e
307 doner, Googlebot robots.txt yerine giris HTML'i alir ve site fiilen
dizinden duserdi. Matcher'a `robots.txt|sitemap.xml|llms.txt` eklendi.

ROBOTS KURALI: kiraci adreslerinde `Disallow: /` (musteri paneli asla
dizine girmez). Platformda panel onekleri kapali ve bu liste
`auth.config.ts`'teki `SUPER_ONEKLERI` + `YONETIM_ONEKLERI`'nden TURETILIR -
yeni yonetim bolumu eklenince robots.txt kendiliginden kapatir. AI
tarayicilarina (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) acik izin
BILEREK yazildi: karar gorunur olsun diye.

KARARLAR:
- `HowTo` KULLANILMADI: Google 2023'te emekliye ayirdi, ItemList tercih edildi.
- `FAQPage` duruyor ama Google'da ACILIR KUTU CIKMAZ (Agustos 2023'ten beri
  yalniz kamu/saglik siteleri); amac AI arama motorlarinda pasaj alintisi.
- UYDURMA VERI YOK: fiyat, aggregateRating, yorum, adres bilerek bos.
  Deponun acik adresi netlesince `LocalBusiness`/`Place` eklenecek
  (yapilandirilmis-veri.ts icindeki LOCAL_BUSINESS_TODO notu).
- Title/H1 Turkce hizmet dili ("depola, paketle, kargoya ver"); "fulfillment"
  govde ve SSS'te destekleyici terim - hedef kitlenin arama dili Turkce.

ICERIK YOL HARITASI: `seo/cluster-plan.md` + `.json`. En onemli bulgu:
incelenen rakiplerin HICBIRI (OPLOG, Idealdepo, EcomMovers, Dopigo, Nexsol...)
ayni markada hem fiziksel depo hizmetini hem bagimsiz kullanilabilen paneli
sunmuyor. Sayfada ayri bir "farklilasma" bolumu bu yuzden var. Plan 2 pillar +
5 kume + 15 spoke oneriyor; su an YALNIZ anasayfa yazildi, spoke sayfalari yok.

## Source Nodes

- TanitimSayfasi()
- yapilandirilmisVeri()
- robots()
- sitemap()
- acikYolMu()
- platformHostuMu()
