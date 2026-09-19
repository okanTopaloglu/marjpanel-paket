import { describe, it, expect } from "vitest";
import {
  BOS_FILTRELER,
  SAYFA_LIMITI,
  aktifFiltreSayisi,
  filtreSorgusu,
  filtreleriCoz,
  sayfaSayisi,
} from "./filtreler";

describe("filtreleriCoz", () => {
  it("boş girdide boş filtre ve ilk sayfa", () => {
    expect(filtreleriCoz({})).toEqual({ filtreler: BOS_FILTRELER, sayfa: 0 });
  });

  it("değerleri kırpar ve dizi gelirse ilkini alır", () => {
    const { filtreler } = filtreleriCoz({
      arama: "  733  ",
      kaynak: ["Trendyol", "N11"],
    });
    expect(filtreler.arama).toBe("733");
    expect(filtreler.kaynak).toBe("Trendyol");
  });

  it("geçersiz tarihi sessizce düşürür", () => {
    const { filtreler } = filtreleriCoz({
      baslangic: "2026-02-30x",
      bitis: "2026-09-18",
    });
    expect(filtreler.baslangic).toBe("");
    expect(filtreler.bitis).toBe("2026-09-18");
  });

  it("sayfayı 0 tabanlıya çevirir, geçersizi ilk sayfaya alır", () => {
    expect(filtreleriCoz({ sayfa: "3" }).sayfa).toBe(2);
    expect(filtreleriCoz({ sayfa: "0" }).sayfa).toBe(0);
    expect(filtreleriCoz({ sayfa: "abc" }).sayfa).toBe(0);
    expect(filtreleriCoz({ sayfa: "-2" }).sayfa).toBe(0);
  });

  it("aramayı 64 karaktere kısar", () => {
    expect(filtreleriCoz({ arama: "X".repeat(200) }).filtreler.arama).toHaveLength(64);
  });
});

describe("filtreSorgusu", () => {
  it("boş filtrede boş sorgu üretir", () => {
    expect(filtreSorgusu(BOS_FILTRELER)).toBe("");
  });

  it("yalnız dolu alanları ve 1'den büyük sayfayı yazar", () => {
    const sorgu = filtreSorgusu({ ...BOS_FILTRELER, kaynak: "Trendyol" }, 2);
    const p = new URLSearchParams(sorgu);
    expect(p.get("kaynak")).toBe("Trendyol");
    expect(p.get("sayfa")).toBe("3");
    expect(p.get("arama")).toBeNull();
  });

  it("çözümle-yaz turu aynı filtreyi verir", () => {
    const filtreler = {
      ...BOS_FILTRELER,
      arama: "733",
      kargo: "Yurtiçi",
      baslangic: "2026-09-01",
    };
    const tekrar = filtreleriCoz(
      Object.fromEntries(new URLSearchParams(filtreSorgusu(filtreler, 1))),
    );
    expect(tekrar.filtreler).toEqual(filtreler);
    expect(tekrar.sayfa).toBe(1);
  });
});

describe("aktifFiltreSayisi", () => {
  it("arama da bir filtredir", () => {
    expect(aktifFiltreSayisi(BOS_FILTRELER)).toBe(0);
    expect(
      aktifFiltreSayisi({ ...BOS_FILTRELER, arama: "733", kargo: "Yurtiçi" }),
    ).toBe(2);
  });
});

describe("sayfaSayisi", () => {
  it("boş liste de bir sayfadır", () => expect(sayfaSayisi(0)).toBe(1));
  it("tam bölünen ve artan sayıyı doğru sayar", () => {
    expect(sayfaSayisi(SAYFA_LIMITI)).toBe(1);
    expect(sayfaSayisi(SAYFA_LIMITI + 1)).toBe(2);
  });
});
