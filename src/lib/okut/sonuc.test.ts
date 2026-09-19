import { describe, it, expect } from "vitest";
import {
  AZAMI_BARKOD_UZUNLUGU,
  barkodDogrula,
  perdeIcerigi,
  sonucEtiketi,
  sonucTonu,
  type OkutmaSonucu,
} from "./sonuc";

const kaydedildi = (uyari?: "bilinmeyen_kargo" | "siparis_yok"): OkutmaSonucu => ({
  sonuc: "kaydedildi",
  barkod: "7331234567890",
  kaynak: "Trendyol",
  kargoFirmasi: "Trendyol Express",
  ...(uyari ? { uyari } : {}),
  rehberli: null,
});

const mukerrer = (ayniKullanici: boolean): OkutmaSonucu => ({
  sonuc: "mukerrer",
  barkod: "7331234567890",
  mevcut: {
    okutanAd: "Ayşe",
    okutmaZamani: "2026-09-18T07:00:00.000Z",
    ayniKullanici,
    profilGorsel: null,
  },
});

describe("barkodDogrula", () => {
  it("kırpar", () => {
    expect(barkodDogrula("  733123  ")).toEqual({ ok: true, barkod: "733123" });
  });

  it("boş barkodu reddeder", () => {
    expect(barkodDogrula("   ").ok).toBe(false);
    expect(barkodDogrula("").ok).toBe(false);
  });

  it("azami uzunluğu aşanı reddeder, sınırdakini kabul eder", () => {
    expect(barkodDogrula("X".repeat(AZAMI_BARKOD_UZUNLUGU)).ok).toBe(true);
    expect(barkodDogrula("X".repeat(AZAMI_BARKOD_UZUNLUGU + 1)).ok).toBe(false);
  });
});

describe("sonucTonu", () => {
  it("temiz kayıt başarıdır", () => expect(sonucTonu(kaydedildi())).toBe("basari"));
  it("uyarılı kayıt uyarıdır", () =>
    expect(sonucTonu(kaydedildi("bilinmeyen_kargo"))).toBe("uyari"));
  it("mükerrer/iptal/kargolanmış hatadır", () => {
    expect(sonucTonu(mukerrer(false))).toBe("hata");
    expect(
      sonucTonu({
        sonuc: "iptal",
        barkod: "b",
        siparis: { siparisNo: "1", platform: "trendyol", entegrasyonAdi: null },
      }),
    ).toBe("hata");
    expect(
      sonucTonu({
        sonuc: "kargolanmis",
        barkod: "b",
        siparis: { siparisNo: "1", platform: "trendyol", entegrasyonAdi: null },
      }),
    ).toBe("hata");
  });
});

describe("perdeIcerigi", () => {
  it("başarılı okutma perde AÇMAZ (akış durmamalı)", () => {
    expect(perdeIcerigi(kaydedildi())).toBeNull();
    // Kargo bilinmiyor uyarısı da akışı durdurmaz; satırda görünür.
    expect(perdeIcerigi(kaydedildi("bilinmeyen_kargo"))).toBeNull();
  });

  it("sipariş yok uyarısı perde açar", () => {
    const p = perdeIcerigi(kaydedildi("siparis_yok"));
    expect(p?.ton).toBe("uyari");
    expect(p?.sureMs).toBeGreaterThan(0);
  });

  it("mükerrerde okutanı söyler; kendisiyse ayrı cümle kurar", () => {
    expect(perdeIcerigi(mukerrer(false))?.baslik).toContain("Ayşe");
    expect(perdeIcerigi(mukerrer(true))?.baslik).toContain("SİZ");
  });

  it("engelli sonuçlar hata tonundadır", () => {
    const p = perdeIcerigi({
      sonuc: "iptal",
      barkod: "b",
      siparis: { siparisNo: "1", platform: "trendyol", entegrasyonAdi: null },
    });
    expect(p?.ton).toBe("hata");
  });
});

describe("sonucEtiketi", () => {
  it("her sonucu kısa metne çevirir", () => {
    expect(sonucEtiketi(kaydedildi())).toBe("Kaydedildi");
    expect(sonucEtiketi(kaydedildi("bilinmeyen_kargo"))).toBe("Kargo bilinmiyor");
    expect(sonucEtiketi(kaydedildi("siparis_yok"))).toBe("Sipariş yok");
    expect(sonucEtiketi(mukerrer(false))).toBe("Mükerrer");
  });
});
