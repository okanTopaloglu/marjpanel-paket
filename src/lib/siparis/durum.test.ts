import { describe, it, expect } from "vitest";
import { gorunenDurum, okutmaEngeli } from "./durum";

describe("gorunenDurum", () => {
  const t = new Date();
  it("kargoda: shipped/delivered + takip no", () => {
    expect(gorunenDurum("Shipped", null, "X")).toBe("kargoda");
    expect(gorunenDurum("Delivered", t, "X")).toBe("kargoda");
    // takip no yoksa hazır/bekleyen'e düşer
    expect(gorunenDurum("Shipped", null, null)).toBe("bekleyen");
  });
  it("hazır: hazir_zamani dolu ve nihai değil", () => {
    expect(gorunenDurum("Picking", t, "X")).toBe("hazir");
    expect(gorunenDurum("Cancelled", t, "X")).toBe("iptal");
  });
  it("bekleyen varsayılan", () => {
    expect(gorunenDurum("Created", null, null)).toBe("bekleyen");
  });
});

describe("okutmaEngeli", () => {
  it("iptal ve kargolanmış engeller", () => {
    expect(okutmaEngeli("Cancelled")).toBe("iptal");
    expect(okutmaEngeli("Shipped")).toBe("kargolanmis");
    expect(okutmaEngeli("Created")).toBeNull();
  });
});
