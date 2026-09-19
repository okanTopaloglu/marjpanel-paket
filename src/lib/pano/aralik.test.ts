import { describe, expect, it } from "vitest";
import { aktifOnAyar, araligiCoz, onAyarAraligi } from "./aralik";
import { buyumeYuzdesi, isiYogunlugu, payYuzdesi } from "./hesap";

// 2026-09-16 bir Çarşamba; ay ortası seçildi ki "bu ay" ve "bu hafta"
// birbirine karışmasın.
const CARSAMBA = "2026-09-16";

describe("onAyarAraligi", () => {
  it("bugün ve dün tek günlük aralıktır", () => {
    expect(onAyarAraligi("bugun", CARSAMBA)).toEqual({
      baslangic: CARSAMBA,
      bitis: CARSAMBA,
    });
    expect(onAyarAraligi("dun", CARSAMBA)).toEqual({
      baslangic: "2026-09-15",
      bitis: "2026-09-15",
    });
  });

  it("bu hafta pazartesiden bugüne sayar", () => {
    expect(onAyarAraligi("buHafta", CARSAMBA)).toEqual({
      baslangic: "2026-09-14",
      bitis: CARSAMBA,
    });
    // Pazar, haftanın SON günüdür: aralık o haftanın pazartesisinde başlar.
    expect(onAyarAraligi("buHafta", "2026-09-20")).toEqual({
      baslangic: "2026-09-14",
      bitis: "2026-09-20",
    });
  });

  it("bu ay ayın 1'inden bugüne, geçen ay tam aydır", () => {
    expect(onAyarAraligi("buAy", CARSAMBA)).toEqual({
      baslangic: "2026-09-01",
      bitis: CARSAMBA,
    });
    expect(onAyarAraligi("gecenAy", CARSAMBA)).toEqual({
      baslangic: "2026-08-01",
      bitis: "2026-08-31",
    });
  });

  it("yıl başında geçen ay bir önceki yıla düşer", () => {
    expect(onAyarAraligi("gecenAy", "2026-01-10")).toEqual({
      baslangic: "2025-12-01",
      bitis: "2025-12-31",
    });
  });

  it("şubat ve artık yıl gün sayısını doğru bulur", () => {
    expect(onAyarAraligi("gecenAy", "2024-03-05").bitis).toBe("2024-02-29");
    expect(onAyarAraligi("gecenAy", "2026-03-05").bitis).toBe("2026-02-28");
  });
});

describe("aktifOnAyar", () => {
  it("eşleşen ön ayarı bulur, özel aralıkta null döner", () => {
    expect(aktifOnAyar({ baslangic: CARSAMBA, bitis: CARSAMBA }, CARSAMBA)).toBe("bugun");
    expect(aktifOnAyar({ baslangic: "2026-09-01", bitis: CARSAMBA }, CARSAMBA)).toBe("buAy");
    expect(aktifOnAyar({ baslangic: "2026-09-03", bitis: "2026-09-07" }, CARSAMBA)).toBeNull();
  });
});

describe("araligiCoz", () => {
  it("geçersiz ya da eksik değerde bugüne düşer", () => {
    expect(araligiCoz(null, null, CARSAMBA)).toEqual({
      baslangic: CARSAMBA,
      bitis: CARSAMBA,
    });
    expect(araligiCoz("dun", "yarin", CARSAMBA)).toEqual({
      baslangic: CARSAMBA,
      bitis: CARSAMBA,
    });
  });

  it("tek uç verilirse diğerine kopyalar", () => {
    expect(araligiCoz("2026-09-01", null, CARSAMBA)).toEqual({
      baslangic: "2026-09-01",
      bitis: "2026-09-01",
    });
  });

  it("ters verilen aralığı takas eder", () => {
    expect(araligiCoz("2026-09-10", "2026-09-01", CARSAMBA)).toEqual({
      baslangic: "2026-09-01",
      bitis: "2026-09-10",
    });
  });
});

describe("hesap yardımcıları", () => {
  it("büyüme yüzdesini tek ondalıkla verir, taban sıfırsa 0", () => {
    expect(buyumeYuzdesi(120, 100)).toBe(20);
    expect(buyumeYuzdesi(75, 100)).toBe(-25);
    expect(buyumeYuzdesi(7, 3)).toBe(133.3);
    expect(buyumeYuzdesi(40, 0)).toBe(0);
  });

  it("ısı yoğunluğu boş hücrede 0, en yoğun hücrede 1", () => {
    expect(isiYogunlugu(0, 10)).toBe(0);
    expect(isiYogunlugu(10, 10)).toBeCloseTo(1, 5);
    // Karekök ölçeği düşük değerleri yukarı çeker.
    expect(isiYogunlugu(1, 100)).toBeGreaterThan(0.12);
    expect(isiYogunlugu(1, 100)).toBeLessThan(0.3);
  });

  it("bar yüzdesi görünür bir taban bırakır", () => {
    expect(payYuzdesi(10, 10)).toBe(100);
    expect(payYuzdesi(1, 1000)).toBe(2);
    expect(payYuzdesi(0, 10)).toBe(0);
  });
});
