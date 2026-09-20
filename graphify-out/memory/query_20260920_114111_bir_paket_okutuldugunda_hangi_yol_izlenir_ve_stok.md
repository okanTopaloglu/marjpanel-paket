---
type: "query"
date: "2026-09-20T11:41:11.758658+00:00"
question: "Bir paket okutuldugunda hangi yol izlenir ve stok/kesim zinciri kac topluluk sinirini gecer?"
contributor: "graphify"
source_nodes: ["paketOkut()", "okutmaKaydet()", "hazirIsaretle()", "takipNoIleSiparis()", "kuralEslestir()", "paketOkutmalari", "stokCte()", "donemPaketSayisi()", "kesimHesapla()", "donemSarfGideri()"]
---

# Q: Bir paket okutuldugunda hangi yol izlenir ve stok/kesim zinciri kac topluluk sinirini gecer?

## Answer

Paket okutma zinciri iki yarimdan olusur. (1) YAZMA YOLU, tek transaction: paketOkut() [actions/okut.ts] -> barkodDogrula() -> okutmaKaydet() [repos/paketler.ts]; okutmaKaydet icinde takipNoIleSiparis() (satir 165) ve hazirIsaretle() (satir 197, ayni tx) cagrilir; barkod kurallari kuralEslestir() [lib/barkod/coz.ts] ile cozulur. Bu yarim Okutma Akisi (C17), Okutma Modu (C15) ve Barkod Kurallari (C11) topluluklarini gecer. (2) OKUMA YOLU: stok dusumu, hesap kesimi, sarf tuketimi ve pano OKUTMA ANINDA TETIKLENMEZ; paket_okutmalari tablosundan sorgu aninda turetilir (stokCte, donemPaketSayisi, donemSarfGideri, genelPano). Grafikte paketOkut'tan stokCte/kesimHesapla'ya hicbir EXTRACTED call yolu yoktur; tek kopru schema.ts'teki paketOkutmalari dugumu (7 repo dosyasi onu okur) ve INFERRED `sql` kenarlaridir. Mimari sonuc: okutma yazar, geri kalan her sey ayni tablodan okur; cift kayit/tutarsizlik riski yok ama tarife veya norm degisince gecmis rakamlar da degisir (kesim kesildiginde tutar hesap_kesimleri'ne donar). AST, transaction callback icindeki hazirIsaretle cagrisini kacirdi; grafikte imports kenari var, calls kenari yok.

## Source Nodes

- paketOkut()
- okutmaKaydet()
- hazirIsaretle()
- takipNoIleSiparis()
- kuralEslestir()
- paketOkutmalari
- stokCte()
- donemPaketSayisi()
- kesimHesapla()
- donemSarfGideri()