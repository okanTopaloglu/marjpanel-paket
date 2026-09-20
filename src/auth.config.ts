import type { NextAuthConfig } from "next-auth";

/**
 * EDGE-UYUMLU TEMEL YAPILANDIRMA.
 * ---------------------------------------------------------------------------
 * Bu dosya middleware'de (Edge çalışma zamanı) çalışır: veritabanı, argon2 ya
 * da başka bir Node yerel modülü İTHAL EDİLEMEZ. Gerçek Credentials provider
 * ve parola doğrulaması `auth.ts`tedir (Node çalışma zamanı).
 *
 * `authorized` callback'i yalnız KABA YÖNLENDİRME yapar (hangi rol hangi
 * bölümü görür). Asıl yetki kontrolü sayfanın/eylemin kendisinde, DB'den taze
 * okunan `Kapsam` ile yapılır (lib/auth/yetki.ts) — JWT'deki rol iddiasına
 * tek başına güvenilmez.
 */

/**
 * Oturumsuz erişilebilen yollar. Diğer her şey oturum ister.
 *
 * "/" BURADADIR ama panelin ana ekranı da "/"dur. Çelişki değil: kök yolda
 * oturumsuz ziyaretçi TANITIM sayfasını görür (app/page.tsx), girişli
 * kullanıcı panele yönlendirilir. Kararı sayfanın kendisi verir çünkü kiracı
 * host'unda (sirket.marjpanel.com) tanıtım HİÇ gösterilmez — bu ayrım DB'ye
 * bakmayı gerektirir ve Edge middleware'de yapılamaz.
 */
const ACIK_YOLLAR = new Set(["/", "/tanitim", "/giris", "/kayit"]);

/** Tanıtım sayfasının alt yolları da oturumsuz açıktır (SSS, gizlilik vb. yok; şimdilik yalnız kök). */
export function acikYolMu(yol: string): boolean {
  return ACIK_YOLLAR.has(yol);
}

/**
 * Yalnız platform sahibinin (super_admin) görebildiği alan.
 * DIŞA AÇIK: app/robots.ts bu listeden Disallow üretir — yeni bir yönetim
 * öneki eklenince robots.txt'in unutulmaması için tek kaynak burasıdır.
 */
export const SUPER_ONEKLERI = ["/sirketler", "/mal-kabul", "/hesap-kesimi", "/sarf", "/pano", "/platform", "/api/tani"];

/**
 * Çalışanın giremediği yönetim alanları. Çalışanın işi okutmadır; bu
 * ekranlara girerse ana ekrana (okutma) geri gönderilir.
 */
export const YONETIM_ONEKLERI = [
  "/kullanicilar",
  "/barkod-kurallari",
  "/entegrasyonlar",
  "/siparisler",
  "/urunler",
  "/uygulamalar",
  "/stok",
  "/hesabim",
];

function onektenMi(yol: string, onekler: readonly string[]): boolean {
  return onekler.some((o) => yol === o || yol.startsWith(`${o}/`));
}

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/giris" },
  trustHost: true,
  providers: [], // auth.ts'te doldurulur (Credentials + argon2 + DB)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const girisli = !!auth?.user;
      const rol = auth?.user?.rol;
      const yol = nextUrl.pathname;

      /**
       * Açık yollar. Girişli kullanıcı /giris ve /kayit'ta işi yoksa panele
       * gönderilir; KÖK YOL İSTİSNADIR çünkü panelin ana ekranı da "/"dur —
       * buradan "/"a yönlendirmek sonsuz döngü olurdu. Kökte ne gösterileceğine
       * (tanıtım mı panel mi) sayfanın kendisi karar verir.
       */
      if (acikYolMu(yol)) {
        if (girisli && yol !== "/") return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      /**
       * API rotaları kendi kapılarını kendileri kurar (route handler'lar
       * `Kapsam` ile gate'lenir). Buradan HTML yönlendirmesi dönerse istemci
       * JSON beklerken giriş sayfasını alır; doğru HTTP kodu route'a aittir.
       */
      if (yol.startsWith("/api/")) return true;

      /**
       * Oturumsuz → false. Yönlendirmeyi middleware yapar (`/giris?geri=...`):
       * kullanıcı girişten sonra gitmek istediği yere dönebilsin.
       * NOT: middleware bir sarmalayıcı fonksiyon verdiği için Auth.js'in
       * kendi otomatik yönlendirmesi devreye girmez (bkz. middleware.ts).
       */
      if (!girisli) return false;

      // Platform alanı: yalnız super_admin.
      if (onektenMi(yol, SUPER_ONEKLERI) && rol !== "super_admin") {
        return Response.redirect(new URL("/", nextUrl));
      }

      // Yönetim alanları: çalışan giremez.
      if (onektenMi(yol, YONETIM_ONEKLERI) && rol === "calisan") {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },

    /**
     * Jetona yalnız yönlendirme için gereken üç alan yazılır. `ad` Auth.js'in
     * standart `name` alanında taşınır (provider `name: ad` döndürür).
     */
    jwt({ token, user }) {
      if (user) {
        token.kullaniciId = user.id;
        token.sirketId = user.sirketId;
        token.rol = user.rol;
      }
      return token;
    },

    /**
     * Jeton alanları TİP KONTROLÜYLE okunur. `JWT` arayüzü `Record<string,
     * unknown>` tabanlıdır (Auth.js çekirdeği) — yani derleyici burada bize
     * hiçbir garanti vermez. Eski bir jeton, elle kurcalanmış bir çerez ya da
     * sürüm geçişi beklenmedik bir şey taşıyorsa alan sessizce boş kalır,
     * oturum uydurulmuş bir rolle dolmaz.
     */
    session({ session, token }) {
      const kid = token.kullaniciId;
      if (typeof kid === "string") session.user.id = kid;

      const sid = token.sirketId;
      if (typeof sid === "string") session.user.sirketId = sid;

      const rol = token.rol;
      if (rol === "super_admin" || rol === "admin" || rol === "calisan") {
        session.user.rol = rol;
      }

      session.user.ad = typeof token.name === "string" ? token.name : "";
      return session;
    },
  },
} satisfies NextAuthConfig;
