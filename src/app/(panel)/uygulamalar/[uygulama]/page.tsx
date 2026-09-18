import { notFound, redirect } from "next/navigation";
import { Share2, FileText, Mail, type LucideIcon } from "lucide-react";
import { panelKapsami } from "@/lib/auth/yetki";
import type { SirketOzellikleri } from "@/lib/auth/kapsam";
import { SayfaBasligi } from "@/components/panel/sayfa-basligi";
import { BosDurum } from "@/components/panel/bos-durum";

/**
 * Uygulama sözlüğü — geçerli uygulama anahtarları, şirketin hangi özellik
 * bayrağının bu uygulamayı açtığı ve başlık/açıklama/ikon.
 *
 * Yalnız buradaki anahtarlarla eşleşen bir rota render edilir; hem geçersiz
 * bir anahtar hem de kapalı bir özellik bayrağı aynı 404'e düşer — kullanıcı
 * arayüzden hiç erişemeyeceği bir uygulamanın var olduğunu URL'den de
 * öğrenmemeli.
 */
const UYGULAMA_SOZLUGU = {
  "fatura-paylas": {
    bayrak: "faturaPaylas",
    baslik: "Fatura Paylaş",
    aciklama: "Faturaları müşteriyle hızlıca paylaşın.",
    ikon: Share2,
    yakinda: "Fatura paylaşım bağlantıları burada oluşturulacak.",
  },
  "fatura-kesim": {
    bayrak: "faturaKesim",
    baslik: "Fatura Kesim",
    aciklama: "Siparişler için fatura kesim işlemleri.",
    ikon: FileText,
    yakinda: "Sipariş faturalarının kesimi burada yapılacak.",
  },
  mail: {
    bayrak: "mail",
    baslik: "Mail",
    aciklama: "Şirket e-postalarını buradan yönetin.",
    ikon: Mail,
    yakinda: "E-posta gönderimi ve şablonları burada yönetilecek.",
  },
} satisfies Record<
  string,
  {
    bayrak: keyof SirketOzellikleri;
    baslik: string;
    aciklama: string;
    ikon: LucideIcon;
    yakinda: string;
  }
>;

type UygulamaAnahtari = keyof typeof UYGULAMA_SOZLUGU;

function gecerliAnahtarMi(deger: string): deger is UygulamaAnahtari {
  return deger in UYGULAMA_SOZLUGU;
}

export default async function UygulamaSayfasi({
  params,
}: {
  params: Promise<{ uygulama: string }>;
}) {
  const { uygulama } = await params;
  if (!gecerliAnahtarMi(uygulama)) notFound();

  const kapsam = await panelKapsami();
  if (!kapsam) redirect("/giris");

  const tanim = UYGULAMA_SOZLUGU[uygulama];
  if (!kapsam.sirket.ozellikler[tanim.bayrak]) notFound();

  return (
    <>
      <SayfaBasligi baslik={tanim.baslik} aciklama={tanim.aciklama} />
      <BosDurum ikon={tanim.ikon} baslik={`${tanim.baslik} yakında`} aciklama={tanim.yakinda} />
    </>
  );
}
