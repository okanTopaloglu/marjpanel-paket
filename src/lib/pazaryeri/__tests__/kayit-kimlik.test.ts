import { describe, it, expect, beforeAll } from "vitest";
import { PAZARYERLERI, PLATFORMLAR_HAZIR_MI, kaynaktanPlatform, pazaryeriAdi, platformMi } from "./yardimci";
import { PLATFORMLAR } from "../tipler";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY ??= "test-anahtari-32-bayt-olmasa-da-sha256-alinir";
});

describe("kayit", () => {
  it("her platformun tanımı var, hesap kimliği alanı alan listesinde ve zorunlu", () => {
    for (const p of PLATFORMLAR) {
      const t = PAZARYERLERI[p];
      expect(t.anahtar).toBe(p);
      const hesap = t.alanlar.find((a) => a.ad === t.hesapKimligiAlani);
      expect(hesap, `${p}: hesapKimligiAlani alanlarda yok`).toBeTruthy();
      expect(hesap?.zorunlu).toBe(true);
      expect(hesap?.tip).toBe("metin");
      expect(t.renk).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("hazır platformlar: Trendyol, Hepsiburada, N11 (M6-B)", () => {
    expect(PLATFORMLAR_HAZIR_MI()).toEqual({ trendyol: true, hepsiburada: true, n11: true });
  });

  it("platformMi / pazaryeriAdi", () => {
    expect(platformMi("trendyol")).toBe(true);
    expect(platformMi("Trendyol")).toBe(false);
    expect(platformMi(null)).toBe(false);
    expect(pazaryeriAdi("n11")).toBe("N11");
    expect(pazaryeriAdi("bilinmeyen")).toBe("bilinmeyen");
  });

  it("kaynaktanPlatform barkod kuralı kaynaklarını çözer", () => {
    expect(kaynaktanPlatform("Trendyol")).toBe("trendyol");
    expect(kaynaktanPlatform("Trendyol Express")).toBe("trendyol");
    expect(kaynaktanPlatform("Amazon FBA")).toBe("amazon");
    expect(kaynaktanPlatform("İdefix")).toBe("idefix");
    expect(kaynaktanPlatform("idefix")).toBe("idefix");
    expect(kaynaktanPlatform("e-Ticaret")).toBeNull();
    expect(kaynaktanPlatform("Novadan")).toBeNull();
    expect(kaynaktanPlatform("")).toBeNull();
    expect(kaynaktanPlatform(null)).toBeNull();
  });
});

describe("kimlik", () => {
  it("şema: yeni kayıtta gizli alan zorunlu, düzenlemede boş olabilir; desen uygulanır", async () => {
    const { kimlikSemasi } = await import("../kimlik");
    const yeni = kimlikSemasi("trendyol");
    expect(yeni.safeParse({ saticiId: "123", apiKey: "a", apiSecret: "b" }).success).toBe(true);
    expect(yeni.safeParse({ saticiId: "123", apiKey: "", apiSecret: "b" }).success).toBe(false);
    expect(yeni.safeParse({ saticiId: "abc", apiKey: "a", apiSecret: "b" }).success).toBe(false);

    const duzenle = kimlikSemasi("trendyol", true);
    expect(duzenle.safeParse({ saticiId: "123", apiKey: "", apiSecret: "" }).success).toBe(true);
    expect(duzenle.safeParse({ saticiId: "", apiKey: "", apiSecret: "" }).success).toBe(false);
  });

  it("şifrele/çöz gidiş-dönüş, maskeleme yalnız gizli alanları gizler", async () => {
    const { kimlikCoz, kimlikMaskele, kimlikSifrele, hesapKimligi } = await import("../kimlik");
    const k = { saticiId: "123456", apiKey: "ANAHTAR-1234567890", apiSecret: "GIZLI-1234567890" };
    const yuk = kimlikSifrele(k);
    expect(yuk).not.toContain("ANAHTAR");
    expect(kimlikCoz(yuk)).toEqual(k);

    const m = kimlikMaskele("trendyol", k);
    expect(m.saticiId).toBe("123456");
    expect(m.apiKey).not.toBe(k.apiKey);
    expect(m.apiKey).toContain("*");
    expect(hesapKimligi("trendyol", k)).toBe("123456");
  });

  it("birleştirme: boş gizli alan eskisini korur, metin alan üzerine yazar", async () => {
    const { kimlikBirlestir } = await import("../kimlik");
    const eski = { saticiId: "1", apiKey: "eskiK", apiSecret: "eskiS" };
    const sonuc = kimlikBirlestir(PAZARYERLERI.trendyol.alanlar, eski, {
      saticiId: "2",
      apiKey: "",
      apiSecret: "yeniS",
    });
    expect(sonuc).toEqual({ saticiId: "2", apiKey: "eskiK", apiSecret: "yeniS" });
  });
});
