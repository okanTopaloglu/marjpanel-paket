import { describe, it, expect } from "vitest";
import {
  tarihPencereleri,
  senkronBaslangici,
  CAKISMA_PAYI_MS,
  ILK_SENKRON_GUN,
} from "./pencere";

const GUN = 86_400_000;

describe("tarihPencereleri", () => {
  it("14 günden kısa aralık tek pencere", () => {
    const b = Date.UTC(2026, 2, 1);
    const s = Date.UTC(2026, 2, 5);
    expect(tarihPencereleri(b, s)).toEqual([{ baslangic: b, bitis: s }]);
  });

  it("30 günü 14 günlük parçalara böler, son parça kısa kalır", () => {
    const b = Date.UTC(2026, 2, 1);
    const s = b + 30 * GUN;
    const p = tarihPencereleri(b, s);
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual({ baslangic: b, bitis: b + 14 * GUN });
    expect(p[1]).toEqual({ baslangic: b + 14 * GUN, bitis: b + 28 * GUN });
    expect(p[2]).toEqual({ baslangic: b + 28 * GUN, bitis: s });
    // Parçalar bitişik: aralıkta boşluk kalmaz.
    expect(p[2]?.bitis).toBe(s);
  });

  it("azami gün sayısı ayarlanabilir", () => {
    const b = 0;
    expect(tarihPencereleri(b, 3 * GUN, 1)).toHaveLength(3);
  });

  it("geçersiz aralıkta boş dizi", () => {
    expect(tarihPencereleri(100, 100)).toEqual([]);
    expect(tarihPencereleri(200, 100)).toEqual([]);
    expect(tarihPencereleri(Number.NaN, 100)).toEqual([]);
  });
});

describe("senkronBaslangici", () => {
  const simdi = new Date("2026-03-15T12:00:00Z");

  it("ilk senkronda 30 gün geriye gider", () => {
    expect(senkronBaslangici(null, simdi)).toBe(
      simdi.getTime() - ILK_SENKRON_GUN * GUN,
    );
  });

  it("son senkrondan 5 dk geriye çakışma payı bırakır", () => {
    const son = new Date("2026-03-15T11:00:00Z");
    expect(senkronBaslangici(son, simdi)).toBe(son.getTime() - CAKISMA_PAYI_MS);
  });

  it("geçersiz tarih ilk senkron gibi ele alınır", () => {
    expect(senkronBaslangici(new Date("gecersiz"), simdi)).toBe(
      simdi.getTime() - ILK_SENKRON_GUN * GUN,
    );
  });
});

describe("geniş tarama", () => {
  const simdi = new Date("2026-09-19T12:00:00Z");
  it("hiç yapılmadıysa ya da 15 dk geçtiyse gerekir", async () => {
    const { genisTaramaGerekliMi, taramaBaslangici, GENIS_TARAMA_GUN } = await import("./pencere");
    expect(genisTaramaGerekliMi(null, simdi)).toBe(true);
    expect(genisTaramaGerekliMi(new Date(simdi.getTime() - 14 * 60_000), simdi)).toBe(false);
    expect(genisTaramaGerekliMi(new Date(simdi.getTime() - 16 * 60_000), simdi)).toBe(true);
    // Geniş: son senkron 1 dk önce olsa da 7 gün geri.
    const sonSenkron = new Date(simdi.getTime() - 60_000);
    expect(taramaBaslangici(sonSenkron, true, simdi)).toBe(simdi.getTime() - GENIS_TARAMA_GUN * 86_400_000);
    expect(taramaBaslangici(sonSenkron, false, simdi)).toBe(sonSenkron.getTime() - 5 * 60_000);
    // İlk senkron (30 gün) zaten daha geride: dokunulmaz.
    expect(taramaBaslangici(null, true, simdi)).toBe(simdi.getTime() - 30 * 86_400_000);
  });
});
