import { describe, it, expect } from "vitest";
import { kuralEslestir, kurallariSirala } from "./coz";
import { VARSAYILAN_KURALLAR } from "./varsayilan-kurallar";

describe("kuralEslestir", () => {
  it("varsayılan kurallarla PartnerSys parser davranışını verir", () => {
    const k = VARSAYILAN_KURALLAR;
    expect(kuralEslestir(k, "7331234")).toMatchObject({ kaynak: "Trendyol", kargoFirmasi: "Trendyol Express" });
    expect(kuralEslestir(k, "72700123")).toMatchObject({ kaynak: "Trendyol", kargoFirmasi: "Sürat Kargo" });
    expect(kuralEslestir(k, "726999")).toMatchObject({ kargoFirmasi: "Aras Kargo" });
    expect(kuralEslestir(k, "627abc")).toMatchObject({ kaynak: "Hepsiburada", kargoFirmasi: "Hepsijet" });
    expect(kuralEslestir(k, "629abc")).toMatchObject({ kargoFirmasi: "Sürat Kargo" });
    expect(kuralEslestir(k, "112x")).toMatchObject({ kaynak: "N11" });
    expect(kuralEslestir(k, "407x")).toMatchObject({ kaynak: "Amazon FBA", kargoFirmasi: "DHL" });
    expect(kuralEslestir(k, "ptt123")).toMatchObject({ kaynak: "e-PTT" });
    expect(kuralEslestir(k, "IPH1")).toMatchObject({ kaynak: "İdefix" });
    expect(kuralEslestir(k, "NV1")).toMatchObject({ kaynak: "Novadan" });
    expect(kuralEslestir(k, "PZ1")).toMatchObject({ kaynak: "Pazarama" });
    expect(kuralEslestir(k, "601")).toMatchObject({ kaynak: "e-Ticaret", kargoFirmasi: "Yurtiçi Kargo" });
  });

  it("62x öneki 60 kuralına düşmez; bilinmeyen için bilinmiyor=true", () => {
    const s = kuralEslestir(VARSAYILAN_KURALLAR, "999");
    expect(s.bilinmiyor).toBe(true);
    expect(s.kaynak).toBe("Bilinmiyor");
    expect(kuralEslestir(VARSAYILAN_KURALLAR, "  733x ").bilinmiyor).toBe(false);
  });

  it("eşit öncelikte uzun önek kazanır, şirket kuralı globali ezer", () => {
    const kurallar = [
      { barkodOneki: "72", kaynak: "A", kargoFirmasi: "A", oncelik: 10, sirketId: null },
      { barkodOneki: "727", kaynak: "B", kargoFirmasi: "B", oncelik: 10, sirketId: null },
      { barkodOneki: "727", kaynak: "S", kargoFirmasi: "S", oncelik: 10, sirketId: "x" },
      { barkodOneki: "7", kaynak: "C", kargoFirmasi: "C", oncelik: 1, sirketId: null, aktif: false },
    ];
    expect(kurallariSirala(kurallar).map((k) => k.kaynak)).toEqual(["S", "B", "A"]);
    expect(kuralEslestir(kurallar, "72700").kaynak).toBe("S");
  });
});
