---
type: "architecture"
date: "2026-09-19T00:00:00+00:00"
question: "Faz B (depo operasyonu ve finans) neyi nasil hesaplar?"
contributor: "graphify"
source_nodes: ["malKabuller", "stokCte()", "sarfMalzemeleri", "sarfStogu()", "sayimFarki()", "tarifeler", "kesimHesapla()", "genelPano()"]
---

# Q: Faz B (depo operasyonu ve finans) neyi nasil hesaplar?

## Answer

DORT PARCA DA CANLIDA (B1+B3 commit ef2d6a1, B2+B4 commit 55720ad):

B1 MAL KABUL + STOK (/mal-kabul, /stok):
  `mal_kabuller` + `mal_kabul_kalemleri` (giris/iade; iade negatif adet yazilir).
  STOK = mal kabul kalem toplami - okutulan paketlerin siparis kalemleri.
  `stokCte()` [repos/stok.ts] lateral join ile `kargo_takip_no`/`siparis_no` eslestirir ve
  `ham_veri._normal.kalemler` jsonb dizisini acar. Turetilen olculer [lib/depo/stok-hesap.ts]:
  kalanAdet, gunlukHiz, tukenmeGun, devirHizi, stokDurumu (eksi/kritik/normal/hareketsiz;
  KRITIK_GUN=7, KRITIK_ADET=5).

B2 SARF MALZEMELERI (/sarf, yalniz super admin):
  `sarf_malzemeleri` (birim, birimMaliyet, paketBasiNorm, normBaslangic, kritikSeviye) +
  `sarf_hareketleri` (alim / sayim / duzeltme).
  TUKETIM TABLOYA YAZILMAZ, TURETILIR: norm x normBaslangic'tan sonra TUM sirketlerin
  okuttugu paket. Stok = hareket toplami - turetilen tuketim.
  SAYIM "stogu bu degere esitle" demektir; kaydedilen hareket `sayimFarki()` = sayilan -
  hesaplanan stok. Boylece gecmis bozulmaz. Alimda tutar girilirse birim maliyet guncellenir.
  Platform duzeyi: sarf MarjPanel'in giderdir, sirkete bagli degildir.

B3 TARIFE + HESAP KESIMI (/hesap-kesimi, /hesap-kesimi/tarife, /hesabim):
  `tarifeler` (gecerlilikBaslangic, kademeTipi toplam|dilimli, kademeler jsonb,
  ekHizmetler jsonb, kdvOrani) -> `kesimHesapla()` [lib/finans/hesap.ts, KURUS tam sayi] ->
  `hesap_kesimleri` (taslak/kesildi/iptal, unique sirket+donem) + `hesap_kesim_kalemleri` +
  `odemeler`. Ucret modeli kullanici karari: HEM kademeli HEM ek hizmet kalemleri.
  Kesim "kesildiginde" tutar donar; taslak halindeyken tarife degisirse tutar da degisir.

B4 GENEL PANO (/pano, super admin):
  `genelPano()` [repos/pano.ts]: sirket bazinda bugun/donem paket, GELIR TAHMINI
  (donem paketi x gecerli tarife, KDV dahil - kesim yapilmamis olabilir), sarf gideri
  (`donemSarfGideri`: paket x norm x maliyet), kar tahmini, bakiye + gecikmis kesim sayisi;
  calisan yuku (kisi basi bugun/donem/gun/paket-gun); gun x saat isi haritasi.
  `repos/istatistik` tek kiraciya bakar, `repos/pano` bilerek SIRKETLER ARASI.

MENU/YETKI: sidebar "Depo" grubu (super: Genel Pano, Mal Kabul, Stoklar, Sarf Malzemeleri,
Hesap Kesimi; admin: Stokum, Hesabim). `auth.config.ts` SUPER_ONEKLERI:
/sirketler /mal-kabul /hesap-kesimi /sarf /pano.

## Source Nodes

- malKabuller
- stokCte()
- sarfMalzemeleri
- sarfStogu()
- sayimFarki()
- tarifeler
- kesimHesapla()
- genelPano()
