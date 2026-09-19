import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { acikYolMu, authConfig } from "@/auth.config";
import { guvenlikBasliklari } from "@/lib/guvenlik/basliklar";

// Edge-uyumlu authConfig ile oturum kontrolü (DB/argon2 içermez).
const { auth } = NextAuth(authConfig);

/**
 * Güvenlik başlıklarını yanıta işler.
 *
 * HTTPS tespiti ters vekil (Coolify/Caddy) arkasında `x-forwarded-proto`
 * başlığından yapılır — uygulama konteynerin İÇİNDE düz http konuşur, yani
 * `nextUrl.protocol` üretimde de "http:" görünür ve HSTS hiç gönderilmezdi.
 */
function basliklariIsle(yanit: NextResponse, istek: Request, protokolYedek: string) {
  const ham = istek.headers.get("x-forwarded-proto") ?? protokolYedek;
  const https = ham.split(",")[0]?.trim() === "https";
  for (const [ad, deger] of Object.entries(guvenlikBasliklari({ https }))) {
    yanit.headers.set(ad, deger);
  }
  return yanit;
}

export default auth((istek) => {
  const yol = istek.nextUrl.pathname;
  const protokolYedek = istek.nextUrl.protocol.replace(":", "");
  const girisli = !!istek.auth?.user;

  /**
   * OTURUMSUZ YÖNLENDİRME BURADA YAPILIR, `authorized` callback'inde DEĞİL.
   * Sebep: Auth.js bir middleware sarmalayıcısı verildiğinde `authorized:false`
   * dönüşünün kendi otomatik yönlendirmesini ÇALIŞTIRMAZ (bkz. next-auth
   * lib/index.js → handleAuth). Ayrıca kendi yönlendirmemiz `?geri=` taşır:
   * kullanıcı giriş yaptıktan sonra gitmek istediği sayfaya döner.
   *
   * API rotaları muaftır: kendi kapılarını kurarlar ve JSON bekleyen istemciye
   * giriş sayfasının HTML'i dönmemelidir.
   */
  if (!girisli && !acikYolMu(yol) && !yol.startsWith("/api/")) {
    const hedef = istek.nextUrl.clone();
    hedef.pathname = "/giris";
    hedef.search = "";
    hedef.searchParams.set("geri", `${yol}${istek.nextUrl.search}`);
    return basliklariIsle(NextResponse.redirect(hedef), istek, protokolYedek);
  }

  /**
   * Sunucu bileşenleri istenen yolu göremez (`layout.tsx`te `usePathname` yok).
   * Panel kabuğu etkin menü öğesini bu başlıktan okur — tek doğruluk kaynağı.
   */
  const basliklar = new Headers(istek.headers);
  basliklar.set("x-pathname", yol);

  const yanit = NextResponse.next({ request: { headers: basliklar } });
  return basliklariIsle(yanit, istek, protokolYedek);
});

export const config = {
  /**
   * Statik dosyalar, Next içselleri, auth API'si ve cron uçları hariç tüm yollar.
   *
   * · /api/auth  → Auth.js'in kendi uçları; middleware'e girerse döngü olur.
   * · /api/cron  → kendi `Bearer CRON_SECRET` kontrolünü yapar; oturumsuz
   *   çağrı /giris'e yönlendirilirse route hiç çalışmaz.
   * · /g/        → ürün ve profil görselleri; oturum çerezi taşımayan
   *   istemciler (pazaryeri, <img> önbelleği) de çeker. Güvenlik oturumdan
   *   değil dosya adının beyaz listeli oluşundan gelir.
   * · PWA dosyaları (manifest, sw.js, offline.html, ikonlar) → service worker
   *   bağlamından oturumsuz istenir; muaf olmazsa tarayıcı JSON beklerken
   *   giriş HTML'i alır ve PWA başlatma zinciri kırılır.
   * · /marka/ ve og.png → marka görselleri. Kelime işareti çevrimdışı sayfada
   *   ve sw precache'inde oturumsuz çekilir; og.png'yi sosyal ağ botları
   *   ister. Muaf olmazsa 307 ile giriş sayfasına düşer ve sw "resim" diye
   *   giriş HTML'ini önbelleğe alır.
   */
  matcher: [
    "/((?!api/auth|api/cron|g/|marka/|_next/static|_next/image|favicon.ico|favicon-32.png|manifest.webmanifest|sw.js|offline.html|apple-touch-icon.png|og.png|icons/).*)",
  ],
};
