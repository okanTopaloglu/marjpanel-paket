import { describe, expect, it } from "vitest";
import { telefonGorunum, telefonMaske, telefonNormalize } from "./telefon";

describe("telefonNormalize", () => {
  it("yaygın yazımları tek formata indirger", () => {
    expect(telefonNormalize("0532 123 45 67")).toBe("5321234567");
    expect(telefonNormalize("+90 532-123-4567")).toBe("5321234567");
    expect(telefonNormalize("905321234567")).toBe("5321234567");
    expect(telefonNormalize("5321234567")).toBe("5321234567");
    expect(telefonNormalize("(0532) 123.45.67")).toBe("5321234567");
  });

  it("geçersiz girdilerde null döner", () => {
    expect(telefonNormalize("")).toBeNull();
    expect(telefonNormalize("abc")).toBeNull();
    expect(telefonNormalize("532123456")).toBeNull(); // eksik hane
    expect(telefonNormalize("53212345678")).toBeNull(); // fazla hane
    expect(telefonNormalize("2121234567")).toBeNull(); // sabit hat (5 ile başlamıyor)
    expect(telefonNormalize("ornek@marjpanel.local")).toBeNull();
  });
});

describe("telefonGorunum", () => {
  it("okunur biçimde gösterir", () => {
    expect(telefonGorunum("5321234567")).toBe("0532 123 45 67");
    expect(telefonGorunum("+905321234567")).toBe("0532 123 45 67");
  });

  it("normalize edilemeyeni aynen döndürür", () => {
    expect(telefonGorunum("bilinmiyor")).toBe("bilinmiyor");
  });
});

describe("telefonMaske", () => {
  it("yazarken kademe kademe gruplar", () => {
    expect(telefonMaske("")).toBe("");
    expect(telefonMaske("0")).toBe("0");
    expect(telefonMaske("053")).toBe("053");
    expect(telefonMaske("0532")).toBe("0532");
    expect(telefonMaske("05321")).toBe("0532 1");
    expect(telefonMaske("0532123")).toBe("0532 123");
    expect(telefonMaske("05321234")).toBe("0532 123 4");
    expect(telefonMaske("053212345")).toBe("0532 123 45");
    expect(telefonMaske("0532123456")).toBe("0532 123 45 6");
    expect(telefonMaske("05321234567")).toBe("0532 123 45 67");
  });

  it("baştaki sıfır eksikse ekler", () => {
    expect(telefonMaske("532")).toBe("0532");
    expect(telefonMaske("5321234567")).toBe("0532 123 45 67");
  });

  it("rakam olmayan karakterleri yok sayar", () => {
    expect(telefonMaske("(0532) 123-45-67")).toBe("0532 123 45 67");
  });

  it("11 haneden fazlasını keser", () => {
    expect(telefonMaske("053212345678999")).toBe("0532 123 45 67");
  });
});
