import { panelKapsami } from "@/lib/auth/yetki";
import { bugunOzet } from "@/lib/db/repos/paketler";
import {
  aktifEntegrasyonVarMi,
  bekleyenSayilari,
} from "@/lib/db/repos/okut-siparis";

/**
 * OKUTMA EKRANI ÖZET UCU - lider tablosu ve bekleyen sayacı buradan beslenir.
 *
 * NEDEN SERVER ACTION DEĞİL: bu uç yazmaz, yalnız okur ve ekran onu 5
 * saniyede bir yoklar. Server action'lar POST'tur ve her çağrıda router
 * önbelleğini tazeler; sıcak bir okutma ekranında bu, tüm sayfanın yeniden
 * doğrulanması demekti. Düz GET yoklaması ekranın geri kalanına dokunmaz.
 *
 * Sayılar ŞİRKET geneli verilir (çalışan da tüm ekibi görür): lider tablosu
 * ortak bir performans göstergesidir, paket listesindeki kişisel kısıt
 * (`calisan` yalnız kendi satırları) burada geçerli değildir.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const kapsam = await panelKapsami();
  if (!kapsam) {
    return Response.json(
      { hata: "Yetkisiz" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const [bugun, bekleyen, aktifEntegrasyon] = await Promise.all([
    bugunOzet(kapsam.sirketId),
    bekleyenSayilari(kapsam.sirketId),
    aktifEntegrasyonVarMi(kapsam.sirketId),
  ]);

  return Response.json(
    { bugun, bekleyen, aktifEntegrasyon },
    // Yoklama ucu: ara katman ya da tarayıcı önbelleğe alırsa sayaç donar.
    { headers: { "Cache-Control": "no-store" } },
  );
}
