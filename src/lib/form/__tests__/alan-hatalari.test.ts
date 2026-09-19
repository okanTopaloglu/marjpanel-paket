import { describe, expect, it } from "vitest";
import { z } from "zod";
import { alanHatalari } from "../alan-hatalari";

describe("alanHatalari", () => {
  it("her alan için ilk hatayı döner", () => {
    const semasi = z.object({
      ad: z.string().min(2, "Ad en az 2 karakter olmalı."),
      telefon: z.string().min(1, "Telefon gerekli."),
    });
    const sonuc = semasi.safeParse({ ad: "a", telefon: "" });
    expect(sonuc.success).toBe(false);
    if (sonuc.success) return;
    expect(alanHatalari(sonuc.error)).toEqual({
      ad: "Ad en az 2 karakter olmalı.",
      telefon: "Telefon gerekli.",
    });
  });

  it("aynı alanda birden çok sorun varsa yalnız ilkini tutar", () => {
    const semasi = z
      .object({ parola: z.string(), parolaTekrar: z.string() })
      .refine((d) => d.parola === d.parolaTekrar, {
        path: ["parolaTekrar"],
        message: "Parolalar aynı değil.",
      })
      .refine((d) => d.parolaTekrar.length >= 6, {
        path: ["parolaTekrar"],
        message: "En az 6 karakter olmalı.",
      });
    const sonuc = semasi.safeParse({ parola: "abcdef", parolaTekrar: "x" });
    expect(sonuc.success).toBe(false);
    if (sonuc.success) return;
    expect(alanHatalari(sonuc.error).parolaTekrar).toBe("Parolalar aynı değil.");
  });

  it("path'i olmayan (kök) hatayı yok sayar", () => {
    const semasi = z.string().refine(() => false, { message: "Kök hata" });
    const sonuc = semasi.safeParse("x");
    expect(sonuc.success).toBe(false);
    if (sonuc.success) return;
    expect(alanHatalari(sonuc.error)).toEqual({});
  });
});
