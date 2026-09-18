import type { DefaultSession } from "next-auth";
import type { KullaniciRolu } from "@/lib/db/schema";

/**
 * Auth.js tip genişletmeleri.
 *
 * JWT'de TAŞINAN ALANLAR SADECE YÖNLENDİRME İÇİNDİR (middleware Edge'de
 * çalışır, veritabanına erişemez). Yetki kararı ve kiracı izolasyonu her
 * istekte DB'den taze okunan `Kapsam` üzerinden verilir (lib/auth/yetki.ts) —
 * jeton iptal edilemez, pasifleştirilen kullanıcı jeton ömrü boyunca yetkili
 * KALMAMALIDIR.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      ad: string;
      rol: KullaniciRolu;
      sirketId: string;
    } & DefaultSession["user"];
  }

  /** `authorize` dönüşü: Auth.js `User`'ına şirket ve rol eklenir. */
  interface User {
    rol?: KullaniciRolu;
    sirketId?: string;
  }
}

/**
 * NOT: `next-auth/jwt` bu sürümde yalnız `@auth/core/jwt`yi yeniden dışa
 * aktarır ve `@auth/core` pnpm'in strict düzeninde kökten çözülemez; bu yüzden
 * aşağıdaki genişletme DERLEYİCİYE ULAŞMAYABİLİR. Sözleşme yine de burada
 * yazılıdır (tek okunabilir kaynak) ama `auth.config.ts` jetondan okurken
 * ona GÜVENMEZ, alanları `typeof` ile süzer.
 */
declare module "next-auth/jwt" {
  interface JWT {
    kullaniciId?: string;
    sirketId?: string;
    rol?: KullaniciRolu;
  }
}
