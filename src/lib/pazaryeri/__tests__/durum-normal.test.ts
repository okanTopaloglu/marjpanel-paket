import { describe, it, expect, vi } from "vitest";
import { DURUM_TABLOLARI, kanonikDurum } from "../durum";
import { SIPARIS_DURUMLARI } from "@/lib/siparis/sabitler";
import { normalZarf, normaldenSatir } from "../normal-veri";
import { musteriAdi, etiketAdresi, siparisKalemleri, aliciTelefonu } from "@/lib/siparis/ham-veri";
import { hamVeridenImza } from "@/lib/siparis/icerik-imzasi";
import type { NormalSiparis } from "../tipler";

describe("kanonikDurum", () => {
  it("her tablo yalnız beyaz listedeki durumlara eşler", () => {
    for (const [platform, tablo] of Object.entries(DURUM_TABLOLARI)) {
      for (const [ham, kanonik] of Object.entries(tablo ?? {})) {
        expect(SIPARIS_DURUMLARI, `${platform}:${ham}`).toContain(kanonik);
      }
    }
  });

  it("Trendyol birebir; boş → Created; bilinmeyen → Created + tek uyarı", () => {
    expect(kanonikDurum("trendyol", "Shipped")).toBe("Shipped");
    expect(kanonikDurum("trendyol", "")).toBe("Created");
    expect(kanonikDurum("trendyol", null)).toBe("Created");

    const uyar = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(kanonikDurum("trendyol", "UydurmaDurumX")).toBe("Created");
    expect(kanonikDurum("trendyol", "UydurmaDurumX")).toBe("Created");
    expect(uyar).toHaveBeenCalledTimes(1);
    uyar.mockRestore();
  });
});

const NORMAL: NormalSiparis = {
  platform: "trendyol",
  siparisKimligi: "P-1",
  siparisNo: "S-1",
  kargoTakipNo: "TK-1",
  kargoFirmasi: "Aras",
  hamDurum: "Picking",
  durum: "Picking",
  siparisTarihi: new Date("2026-03-01T09:00:00Z"),
  musteriAd: "Ayşe Yılmaz",
  adres: { acik: "Örnek Mah. 1. Sk", ilce: "Kadıköy", il: "İstanbul", telefon: "0532" },
  kalemler: [
    { barkod: "B", urunAdi: "Krem", adet: 2 },
    { barkod: "A", urunAdi: "Şampuan", adet: 1 },
  ],
  // Bilerek Trendyol alan adları YOK: okuyucular zarfı kullanmak zorunda.
  ham: { platformaOzel: true },
};

describe("normaldenSatir + _normal zarfı", () => {
  it("satır alanları ve imza; ham yük korunur, zarf eklenir", () => {
    const s = normaldenSatir(NORMAL, "Mağaza");
    expect(s.platform).toBe("trendyol");
    expect(s.siparisKimligi).toBe("P-1");
    expect(s.hamDurum).toBe("Picking");
    expect(s.icerikImzasi).toBe("A:1|B:2");
    expect(s.entegrasyonAdi).toBe("Mağaza");
    expect(s.hamVeri.platformaOzel).toBe(true);
    expect(normalZarf(s.hamVeri)?.musteriAd).toBe("Ayşe Yılmaz");
  });

  it("ham-veri okuyucuları zarfı önceler: etiket/okutma platform bilmez", () => {
    const { hamVeri } = normaldenSatir(NORMAL, "Mağaza");
    expect(musteriAdi(hamVeri)).toBe("Ayşe Yılmaz");
    expect(etiketAdresi(hamVeri)).toEqual({ acik: "Örnek Mah. 1. Sk", ilceIl: "Kadıköy - İstanbul" });
    expect(aliciTelefonu(hamVeri)).toBe("0532");
    expect(siparisKalemleri(hamVeri)).toEqual([
      { barkod: "B", urunAdi: "Krem", adet: 2 },
      { barkod: "A", urunAdi: "Şampuan", adet: 1 },
    ]);
    expect(hamVeridenImza(hamVeri)).toBe("A:1|B:2");
  });

  it("zarfsız eski satırda Trendyol sezgisi çalışmaya devam eder", () => {
    const eski = { customerFirstName: "Ali", customerLastName: "Kaya", lines: [{ barcode: "X", quantity: 3 }] };
    expect(normalZarf(eski)).toBeNull();
    expect(musteriAdi(eski)).toBe("Ali Kaya");
    expect(hamVeridenImza(eski)).toBe("X:3");
  });

  it("bozuk zarf yok sayılır", () => {
    expect(normalZarf({ _normal: "metin" })).toBeNull();
    expect(normalZarf({ _normal: { musteriAd: 1, kalemler: [] } })).toBeNull();
  });
});
