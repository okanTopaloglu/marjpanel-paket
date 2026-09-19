import type { Metadata } from "next";
import { adminKapsamiZorunlu } from "@/lib/auth/yetki";
import { etiketKartlari, type EtiketKarti } from "@/lib/db/repos/siparisler";
import { ISTANBUL_TZ } from "@/lib/siparis/sabitler";
import { EtiketBarkod } from "./etiket-barkod";
import { EtiketQr } from "./etiket-qr";
import { YazdirKontrol } from "./yazdir-kontrol";

export const metadata: Metadata = { title: "Kargo etiketleri" };
export const dynamic = "force-dynamic";

const F_TARIH = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const F_SAAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function tarih(d: Date | null): string {
  return d ? F_TARIH.format(d) : "-";
}
function saat(d: Date | null): string {
  return d ? F_SAAT.format(d) : "-";
}

/**
 * TEK ETİKET (100x120 mm termal kargo etiketi).
 *
 * Yerleşim PartnerSys `barcodePrint.ts`ten taşındı (Trendyol Ekspress
 * görünümü): sol üstte karekod, sağında takip barkodu, altında numaralar ve
 * tarih, sonra alıcı bilgisi, en altta çerçeveli ürün tablosu. İki fark var:
 *
 *  · Kâğıt boyu A4 DEĞİL 100x120 mm ve her etiket AYRI SAYFAYA basılır
 *    (`page-break-after`). PartnerSys A4'e üç etiket sığdırıyordu; termal
 *    yazıcıda bu çıktıyı kullanılamaz kılıyordu.
 *  · Gönderici satırı sabit "Trendyol" değil ŞİRKET ADIdır - etiketi okuyan
 *    kargo görevlisi paketi kimin gönderdiğini görmeli.
 */
function Etiket({ kart }: { kart: EtiketKarti }) {
  const barkodDegeri = kart.kargoTakipNo?.trim() || kart.siparisNo?.trim() || kart.id;
  const kalemler = kart.kalemler.length
    ? kart.kalemler
    : [{ barkod: "-", urunAdi: "", adet: 1 }];

  return (
    <div className="etiket">
      <div className="flex items-start justify-between gap-[3mm]">
        <div className="shrink-0">
          <div className="text-[13px] font-bold leading-tight">
            {kart.kargoFirmasi?.trim() || "Kargo"}
          </div>
          <div className="mt-[1mm]">
            <EtiketQr deger={barkodDegeri} boyut={64} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 justify-end">
          <EtiketBarkod deger={barkodDegeri} />
        </div>
      </div>

      <div className="mt-[1.5mm] flex items-start justify-between gap-2 text-[10px]">
        <div className="min-w-0">
          <div className="break-all font-bold">{kart.kargoTakipNo ?? "-"}</div>
          <div className="mt-[0.5mm] break-all">{kart.siparisNo ?? kart.id}</div>
        </div>
        <div className="shrink-0 text-right">
          <div>S.T: {tarih(kart.siparisTarihi)}</div>
          <div>
            F.T: {tarih(kart.siparisTarihi)} - {saat(kart.siparisTarihi)}
          </div>
        </div>
      </div>

      <div className="mt-[2mm] text-[11px] leading-snug">
        <div>
          <strong>Ad - Soyad :</strong> {kart.musteriAd}
        </div>
        <div className="mt-[1mm] text-[10px]">
          <strong>Adres :</strong> {kart.adresAcik || "-"}
        </div>
        <div className="mt-[1mm] text-center text-[10px] font-bold">
          {kart.adresIlceIl || " "}
        </div>
      </div>

      <div className="mt-[1.5mm] text-[10px]">{kart.gonderici}</div>

      <div className="urun-cerceve mt-[2mm] flex-1">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="urun-baslik">
              <th className="px-[2mm] py-[1mm] text-left font-bold">Ürün Adı</th>
              <th className="w-[14mm] px-[2mm] py-[1mm] text-center font-bold">
                Miktar
              </th>
            </tr>
          </thead>
          <tbody>
            {kalemler.map((k, i) => (
              <tr key={`${k.barkod}-${i}`} className="align-top">
                <td className="kalem-ad px-[2mm] py-[0.8mm]">
                  {k.barkod || "-"} - {k.urunAdi}
                </td>
                <td className="tabular px-[2mm] py-[0.8mm] text-center">{k.adet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ETİKET SAYFASI.
 *
 * Kapı `adminKapsamiZorunlu`: etiket kişiye özel kargo ve adres verisi taşır,
 * çalışan rolü bu sayfayı açamaz. Sayfa yazdırma katmanındadır (kabuk yok) ve
 * arama motorlarına kapalıdır (bkz. (yazdir)/layout.tsx).
 *
 * Siparişler `?siparis=` içinde virgülle gelir; liste ekranı pencereyi tık
 * işleyicisinin içinde senkron açar (aksi hâlde açılır pencere engellenir).
 */
export default async function EtiketSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ siparis?: string }>;
}) {
  const kapsam = await adminKapsamiZorunlu();
  const { siparis } = await searchParams;

  const ids = (siparis ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const kartlar = ids.length ? await etiketKartlari(kapsam, ids) : [];

  return (
    <div className="min-h-svh bg-muted print:bg-white">
      <style>{`
        .etiket {
          width: 100mm;
          height: 120mm;
          padding: 4mm;
          box-sizing: border-box;
          background: #fff;
          color: #000;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: Arial, Helvetica, sans-serif;
          /* Termal baskıda gri tonlu kenar yumuşatma tırtık üretir. */
          -webkit-font-smoothing: auto;
        }
        .urun-cerceve { border: 2px solid #000; }
        .urun-baslik { border-bottom: 2px solid #000; }
        /* Ürün adı en fazla iki satır; taşan kısım kırpılır. -webkit-line-clamp
           kullanılmaz: o katman yazdırma çıktısında rasterleşip bulanıklaşır. */
        .kalem-ad { max-height: calc(2 * 1.3em); overflow: hidden; }
        .etiket-qr { background: #fff; }

        @media screen {
          .etiket {
            margin: 16px auto;
            border: 1px solid #dfe4e8;
            box-shadow: 0 1px 2px rgb(15 27 45 / .06), 0 4px 12px -4px rgb(15 27 45 / .08);
          }
        }

        @media print {
          @page { size: 100mm 120mm; margin: 0; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .etiket {
            margin: 0;
            border: 0;
            box-shadow: none;
            page-break-after: always;
          }
          .etiket:last-child { page-break-after: auto; }
          /* Çerçeve ve karekod SAF SİYAH bassın: tarayıcının "mürekkep
             tasarrufu" kipi çizgileri griye çeker, termal başlık griyi soluk
             basar ve kod okunmaz olur. */
          .urun-cerceve, .urun-baslik, .etiket-qr {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            border-color: #000 !important;
          }
        }
      `}</style>

      <YazdirKontrol ids={kartlar.map((k) => k.id)} />

      {kartlar.length === 0 ? (
        <p className="no-print mx-auto max-w-md px-4 py-16 text-center text-footnote text-muted-foreground">
          {ids.length === 0
            ? "Yazdırılacak sipariş seçilmedi. Siparişler listesinden sipariş seçip Etiket yazdır düğmesine basın."
            : "Seçilen siparişler bulunamadı. Liste yenilendiğinde kayıtlar silinmiş olabilir."}
        </p>
      ) : (
        kartlar.map((k) => <Etiket key={k.id} kart={k} />)
      )}
    </div>
  );
}
