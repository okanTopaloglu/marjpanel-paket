import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { telefonNormalize } from "./lib/format/telefon";
import {
  girisBasarili,
  girisBasarisiz,
  telefonlaGetir,
} from "./lib/db/repos/kullanicilar";
import { getir as sirketGetir } from "./lib/db/repos/sirketler";
import { girisKarari, hostNormalize, platformHostuMu } from "./lib/kiraci/kural";
import { platformHostu } from "./lib/kiraci/coz";

/**
 * Yanlış adresten giriş: parola DOĞRU ama kullanıcı başka kiracının
 * (ya da platformun) adresinde. Hesap sayımı sızdırmaz — yalnız doğru
 * parolayla ulaşılır. `code` içinde doğru adres taşınır ("alan_adi|https://…");
 * giriş eylemi bunu okuyup kullanıcıya gideceği yeri söyler.
 */
export class AlanAdiUyumsuz extends CredentialsSignin {
  constructor(dogruAdres: string) {
    super();
    this.code = `alan_adi|${dogruAdres}`;
  }
}

const girisSemasi = z.object({
  telefon: z.string().min(1),
  parola: z.string().min(1),
});

/**
 * TAM YAPILANDIRMA (DB + argon2). Node çalışma zamanında koşar: route
 * handler'lar, server action'lar, sunucu bileşenleri. Middleware bunu DEĞİL
 * `auth.config.ts`i kullanır (Edge'de argon2/postgres yüklenemez).
 *
 * Credentials provider JWT oturumu ZORUNLU kılar (Auth.js kısıtı).
 *
 * KABA KUVVET: 5 ardışık hatalı deneme → 15 dk hesap kilidi (repo tarafında
 * atomik). Bunun ÖNÜNDE ayrıca IP başına hız sınırı vardır
 * (lib/guvenlik/hiz-siniri) — ikisi farklı saldırıyı durdurur.
 *
 * HER RET AYNI GÖRÜNÜR: kullanıcı yok, pasif, kilitli ya da parola yanlış —
 * hepsi `null` döner. Arayüz tek bir mesaj gösterir; hangi telefonun kayıtlı
 * olduğu dışarıdan okunamaz.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        telefon: { label: "Telefon", type: "tel" },
        parola: { label: "Parola", type: "password" },
      },
      authorize: async (credentials, request) => {
        const cozum = girisSemasi.safeParse(credentials);
        if (!cozum.success) return null;

        // Kayıt ve giriş AYNI normalizasyondan geçer; yoksa unique index
        // eşleşmez (0532..., +90532..., 532... hepsi 5XXXXXXXXX olur).
        const telefon = telefonNormalize(cozum.data.telefon);
        if (!telefon) return null;

        const k = await telefonlaGetir(telefon);
        if (!k || !k.aktif) return null;

        // Kilit süresi dolmadan parola HİÇ doğrulanmaz (argon2 maliyeti de
        // saldırgana yüklenmesin).
        if (k.kilitBitis && k.kilitBitis > new Date()) return null;

        const gecerli = await verify(k.parolaHash, cozum.data.parola);
        if (!gecerli) {
          await girisBasarisiz(k.id);
          return null;
        }
        if (k.hataliDeneme > 0 || k.kilitBitis) await girisBasarili(k.id);

        /*
         * ADRES KAPISI — parola doğrulandıktan SONRA: yanlış parola ile
         * "bu adres size ait değil" demek, telefonun kayıtlı olduğunu ele
         * verirdi. Süper yönetici her adresten girer (kural.ts).
         */
        const host = hostNormalize(
          request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
        );
        const pHost = platformHostu();
        const sirket = await sirketGetir(k.sirketId);
        const karar = girisKarari({
          hostPlatformMu: platformHostuMu(host, pHost),
          host,
          rol: k.rol,
          sirketAlanAdi: sirket?.alanAdi ?? null,
          platformHostu: pHost,
        });
        if (!karar.izin) throw new AlanAdiUyumsuz(karar.dogruAdres);

        return {
          id: k.id,
          name: k.ad,
          rol: k.rol,
          sirketId: k.sirketId,
        };
      },
    }),
  ],
});
