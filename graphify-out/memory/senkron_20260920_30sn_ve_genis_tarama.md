---
type: "architecture"
date: "2026-09-20T00:00:00+00:00"
question: "Siparisler ne siklikla cekilir ve eski siparislerin durumu nasil guncellenir?"
contributor: "graphify"
source_nodes: ["tik()", "vadesiGelenler()", "genisTaramaGerekliMi()", "taramaBaslangici()", "topluUpsert()", "senkronAralikDk", "sonGenisTarama"]
---

# Q: Siparisler ne siklikla cekilir ve eski siparislerin durumu nasil guncellenir?

## Answer

IKI AYRI RITIM VAR (2026-09-19/20'de kuruldu, migration 0006):

1. DAR PENCERE - yeni siparisler. `sirketler.senkron_aralik_dk` artik 0.5..60 dakika
   (eskiden 2..60); VARSAYILAN 0.5 = 30 SANIYE ve mevcut tum sirketler 0.5'e cekildi.
   Zamanlayici turu `TUR_ARALIGI_MS = 30_000` oldugundan pratik alt sinir 30 sn.
   Baslangic ani: son senkron - 5 dk cakisma payi (`senkronBaslangici`).

2. GENIS TARAMA - eski siparislerin DURUM degisikligi. Cogu pazaryeri tarih filtresini
   OLUSTURMA tarihine uygular, bu yuzden "Shipped/Cancelled" olan eski bir siparis dar
   pencereye hic dusmez. Cozum: `entegrasyonlar.son_genis_tarama` sutunu + saf fonksiyonlar
   `genisTaramaGerekliMi()` (15 dk) ve `taramaBaslangici()` (7 gun geri). Her 15 dakikada bir
   son 7 gun bastan taranir; `topluUpsert`'teki `where durum not in (NIHAI_DURUMLAR)` sayesinde
   kargolanmis/iptal satir geri dirilmez.

3. TRENDYOL OZEL: sorgu `orderByField=PackageLastModifiedDate` oldu (eskiden CreatedDate).
   Boylece durum degisen paket dar pencerede de gorunur. Diger platformlarda bu imkan yok,
   onlar genis taramaya guvenir.

Hiz siniri emniyeti degismedi: 429 -> Retry-After kadar (min 60 sn) o entegrasyon ertelenir,
401/403 -> 1 saat. Is basina 5 dk sert sinir. Kilit veritabaninda (`senkron_isleri` kismi tekil
indeks), bu yuzden sure ici zamanlayici + dis cron ayni anda calissa bile is tek kez kosar.

## Source Nodes

- tik()
- vadesiGelenler()
- genisTaramaGerekliMi()
- taramaBaslangici()
- topluUpsert()
- senkronAralikDk
- sonGenisTarama
