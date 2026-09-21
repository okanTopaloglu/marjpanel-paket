import type { Metadata } from "next";
import { MessageCircle, PhoneCall, Inbox, UserPlus } from "lucide-react";
import { superKapsamiZorunlu } from "@/lib/auth/yetki";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { StatKarti } from "@/components/panel/stat-karti";
import { BosDurum } from "@/components/panel/bos-durum";
import { listele, teklifOzeti } from "@/lib/db/repos/teklif";
import { yeniKayitlar } from "@/lib/db/repos/sirketler";
import { sayi } from "@/lib/format/sayi";
import { TalepListesi } from "./talep-listesi";
import { YeniKayitTablosu } from "./yeni-kayit-tablosu";

export const metadata: Metadata = { title: "Talepler ve Kayıtlar" };
export const dynamic = "force-dynamic";

/**
 * TALEPLER — tanıtım sayfasından gelen teklif istekleri ve kendi kendine
 * açılan hesaplar. Yalnız süper yönetici.
 *
 * İKİ AYRI LİSTE, tek ekran: biri henüz müşteri olmayan ADAYLAR (teklif
 * formu), diğeri zaten hesap açmış ŞİRKETLER. İkisi de "kim geldi" sorusunun
 * cevabı olduğu için yan yana durur.
 */
export default async function TaleplerSayfasi() {
  await superKapsamiZorunlu();
  const [talepler, ozet, kayitlar] = await Promise.all([listele(), teklifOzeti(), yeniKayitlar(50)]);

  return (
    <>
      <SayfaBasligi
        baslik="Talepler ve Kayıtlar"
        aciklama="Tanıtım sayfasından gelen teklif istekleri ve kendi kendine açılan hesaplar."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKarti etiket="Teklif talebi" deger={sayi(ozet.toplam)} dipnot={`son 7 günde ${sayi(ozet.sonYediGun)}`} ikon={Inbox} />
        <StatKarti etiket="Yeni (dokunulmadı)" deger={sayi(ozet.yeni)} dipnot="aranacak" ikon={PhoneCall} />
        <StatKarti
          etiket="WhatsApp'a gitmedi"
          deger={sayi(ozet.whatsappsiz)}
          dipnot="formu doldurdu ama yazmadı"
          ikon={MessageCircle}
        />
        <StatKarti etiket="Açılan hesap" deger={sayi(kayitlar.length)} dipnot="kendi kendine kayıt" ikon={UserPlus} />
      </div>

      <h2 className="mb-3 text-title-3">Teklif talepleri</h2>
      {talepler.length === 0 ? (
        <BosDurum
          ikon={Inbox}
          baslik="Henüz teklif talebi yok"
          aciklama="Tanıtım sayfasındaki form doldurulduğunda talepler burada görünür; kişi WhatsApp'a gitmese bile telefonu kaydedilir."
        />
      ) : (
        <TalepListesi satirlar={talepler} />
      )}

      <h2 className="mb-3 mt-8 text-title-3">Kendi kendine açılan hesaplar</h2>
      {kayitlar.length === 0 ? (
        <BosDurum
          ikon={UserPlus}
          baslik="Henüz kayıt yok"
          aciklama="Kayıt açık; biri /kayit adresinden hesap açtığında şirketi, adı, telefonu ve e-postası burada görünür."
        />
      ) : (
        <YeniKayitTablosu satirlar={kayitlar} />
      )}
    </>
  );
}
