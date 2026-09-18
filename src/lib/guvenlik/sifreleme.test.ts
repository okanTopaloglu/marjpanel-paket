import { describe, it, expect, beforeAll } from "vitest";
import { sifrele, coz, maskele } from "./sifreleme";

describe("sifreleme", () => {
  beforeAll(() => {
    process.env.APP_ENCRYPTION_KEY = "test-anahtari";
  });

  it("şifreler ve geri çözer", () => {
    const s = sifrele("api-key-123");
    expect(s).not.toContain("api-key-123");
    expect(s.split(".")).toHaveLength(3);
    expect(coz(s)).toBe("api-key-123");
  });

  it("her şifreleme farklı iv üretir", () => {
    expect(sifrele("a")).not.toBe(sifrele("a"));
  });

  it("bozuk veri hata verir", () => {
    expect(() => coz("abc")).toThrow();
  });

  it("maskele ilk ve son 3 karakteri bırakır", () => {
    expect(maskele("abcdefghij")).toBe("abc****hij");
    expect(maskele("abc")).toBe("***");
  });
});
