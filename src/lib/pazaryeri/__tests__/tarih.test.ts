import { describe, it, expect } from "vitest";
import { dilimsizMetniCoz } from "../tarih";

describe("dilimsizMetniCoz", () => {
  it("işaretsiz metni Türkiye saati sayar, süreç saat diliminden bağımsız", () => {
    expect(dilimsizMetniCoz("2026-03-01T09:00:00")?.toISOString()).toBe("2026-03-01T06:00:00.000Z");
    expect(dilimsizMetniCoz("2026-03-01 09:00")?.toISOString()).toBe("2026-03-01T06:00:00.000Z");
    expect(dilimsizMetniCoz("2026-03-01")?.toISOString()).toBe("2026-02-28T21:00:00.000Z");
    expect(dilimsizMetniCoz("2026-03-01T09:00:00.5")?.getUTCMilliseconds()).toBe(500);
  });

  it("ofset parametresi", () => {
    expect(dilimsizMetniCoz("2026-03-01T09:00:00", 0)?.toISOString()).toBe("2026-03-01T09:00:00.000Z");
  });

  it("bozuk metin null", () => {
    expect(dilimsizMetniCoz("abc")).toBeNull();
    expect(dilimsizMetniCoz("2026-13-45T99:00:00")).not.toBeNull(); // Date.UTC taşırır; çağıran beyaz liste uygular
  });
});
