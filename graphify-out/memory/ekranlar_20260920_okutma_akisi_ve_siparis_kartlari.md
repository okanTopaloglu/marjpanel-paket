---
type: "architecture"
date: "2026-09-20T00:00:00+00:00"
question: "Paket Okut ekrani hangi adimlardan olusur ve ana ekrandaki dort sayac neyi olcer?"
contributor: "graphify"
source_nodes: ["OkutSayfasi()", "ModSec()", "SecimEkrani()", "OkutEkrani()", "siparisAkisi()", "SiparisAkisiKartlari()", "sevkKesimSaati", "kesimAniSql()"]
---

# Q: Paket Okut ekrani hangi adimlardan olusur ve ana ekrandaki dort sayac neyi olcer?

## Answer

PAKET OKUT - UC ADIM, ADIM URL'DE (2026-09-20):
  /okut                      -> ModSec(): Hizli / Rehberli / Toplama karti; kullanicinin
                                etkin modu (`etkinOkutmaModu`: kullanici > sirket varsayilani)
                                "Oneriliyor" rozetiyle isaretli ama secim serbest.
  /okut?mod=hizli            -> SecimEkrani(): ust bantta "Kargoya Verilmesi Gereken"
                                (toplam + magaza kirilimi + yenile), solda kullanici karti
                                (avatar, telefon, rol, bugun okuttugu), ortada ENTEGRASYON
                                LISTESI (Manuel/Karisik = tum kaynaklar + her magaza bekleyen
                                sayisiyla), sagda Bugunku Siralama. 5 sn'de bir /api/okut/ozet.
  /okut?mod=hizli&magaza=X   -> OkutEkrani(), magaza secili gelir, "Magaza degistir" baglantisi.
  /okut?mod=toplama          -> ToplamaModu (kendi kargo secimi).
Adimin URL'de olmasi: geri tusu bir adim geri gider, yenileme secimi kaybetmez.

ANA EKRAN (Ozet) DORT KART - `siparisAkisi()` [repos/siparis-akisi.ts], yalniz yoneticiye ve
yalniz aktif entegrasyon varsa:
  gelen          -> siparis_tarihi secili araliktaysa
  hazirlanan     -> hazir_zamani araliktaysa (okutulup hazir isaretlenen)
  kargoyaVerilen -> kargo_zamani araliktaysa (pazaryeri "Shipped/Delivered" dedi)
  sevkGereken    -> ARALIKTAN BAGIMSIZ, "su an": durum nihai degil VE siparis_tarihi bugunku
                    kesim aninden once. Dunun kalanlari da buradadir. Dipnotta kesim sonrasi sayi.
Her kartta entegrasyon kirilimi rozet olarak durur.

SEVK KESIM SAATI artik sirket bazli: `sirketler.sevk_kesim_saati` (0..23, varsayilan 17),
Ayarlar > "Sevk kesim saati" karti (yonetici). `kesimAniSql(saat)` SQL'de
`AT TIME ZONE 'Europe/Istanbul'` ile hesaplar; `sekmeKosulu(sekme, kesimSaati)` de ayni saati
kullanir, yani Siparisler'deki "Sevk gecikmis" sekmesi ile ana ekran karti AYNI esige bakar.

## Source Nodes

- OkutSayfasi()
- ModSec()
- SecimEkrani()
- OkutEkrani()
- siparisAkisi()
- SiparisAkisiKartlari()
- sevkKesimSaati
- kesimAniSql()
