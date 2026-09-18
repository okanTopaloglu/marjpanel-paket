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

/** Oturumsuz erişilebilen yollar. Diğer her şey oturum ister. */
const ACIK_YOLLAR = new Set(["/giris", "/kayit"]);

export function acikYolMu(yol: string): boolean {
  return ACIK_YOLLAR.has(yol);
}

/** Yalnız platform sahibinin (super_admin) görebildiği alan. */
const SUPER_ONEKLERI = ["/sirketler"];

/**
 * Çalışanın giremediği yönetim alanları. Çalışanın işi okutmadır; bu
 * ekranlara girerse ana ekrana (okutma) geri gönderilir.
 */
const YONETIM_ONEKLERI = [
  "/kullanicilar",
  "/barkod-kurallari",
  "/entegrasyonlar",
  "/siparisler",
  "/urunler",
  "/uygulamalar",
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

      // Açık yollar: girişliyse burada işi yok, panele gönder.
      if (acikYolMu(yol)) {
        if (girisli) return Response.redirect(new URL("/", nextUrl));
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

    session({ session, token }) {
      if (token.kullaniciId) session.user.id = token.kullaniciId;
      if (token.sirketId) session.user.sirketId = token.sirketId;
      if (token.rol) session.user.rol = token.rol;
      session.user.ad = token.name ?? "";
      return session;
    },
  },
} satisfies NextAuthConfig;
