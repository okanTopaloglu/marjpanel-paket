import { describe, it, expect } from "vitest";
import { sekmeKosulu, KESIM_ANI_SQL } from "./sekme-sql";
import { SEKMELER } from "./durum";

describe("sekmeKosulu", () => {
  it("her sekme için boş olmayan koşul üretir", () => {
    for (const s of SEKMELER) {
      expect(sekmeKosulu(s).trim().length).toBeGreaterThan(0);
    }
  });

  it("tumu her satırı geçirir", () => {
    expect(sekmeKosulu("tumu")).toBe("true");
  });

  it("bekleyen: hazır olmayan ve havuzdan çıkmamış satırlar", () => {
    const k = sekmeKosulu("bekleyen");
    expect(k).toContain("hazir_zamani is null");
    expect(k).toContain("durum not in ('Shipped', 'Delivered', 'Cancelled')");
  });

  it("bekleyen_kargo yalnız havuz içi ham durumları alır", () => {
    expect(sekmeKosulu("bekleyen_kargo")).toContain(
      "durum in ('Created', 'Picking', 'Invoiced')",
    );
  });

  it("hazir: hazır zamanı dolu, kargoya verilmemiş", () => {
    const k = sekmeKosulu("hazir");
    expect(k).toContain("hazir_zamani is not null");
    expect(k).toContain("not in ('Shipped', 'Delivered', 'Cancelled')");
  });

  it("kargoda BOŞ takip numarasını dışarıda bırakır", () => {
    const k = sekmeKosulu("kargoda");
    expect(k).toContain("kargo_takip_no is not null");
    expect(k).toContain("kargo_takip_no <> ''");
  });

  it("iptal yalnız Cancelled", () => {
    expect(sekmeKosulu("iptal")).toBe("durum = 'Cancelled'");
  });

  it("sevk_gecikmis nihai durumları dışlar ve İstanbul kesim anını kullanır", () => {
    const k = sekmeKosulu("sevk_gecikmis");
    expect(k).toContain(
      "durum not in ('Shipped', 'Delivered', 'Cancelled', 'Returned')",
    );
    expect(k).toContain("siparis_tarihi <");
    expect(k).toContain("Europe/Istanbul");
  });

  it("kesim anı iki kez saat dilimi çevirir (naive -> timestamptz)", () => {
    // İlk çevrim duvar saatine iner, ikincisi mutlak ana döner; biri eksikse
    // eşik konteynerin saat dilimine kayar.
    const adet = KESIM_ANI_SQL.split("at time zone").length - 1;
    expect(adet).toBe(2);
    expect(KESIM_ANI_SQL).toContain("interval '17 hours'");
    expect(KESIM_ANI_SQL).toContain("date_trunc('day'");
  });

  it("koşullarda tek tırnak içine kullanıcı girdisi sızmaz (yalnız beyaz liste)", () => {
    for (const s of SEKMELER) {
      // Beyaz listedeki değerler harf/rakam; ters eğik çizgi ya da noktalı
      // virgül görürsek sabitler bozulmuş demektir.
      expect(sekmeKosulu(s)).not.toContain("\\");
      expect(sekmeKosulu(s)).not.toContain(";");
    }
  });
});
