import { describe, it, expect } from "vitest";
import { jestKarari } from "../yay";

/**
 * Mobil çekmecede bağlantıya basılıp sayfaya gidilememesinin sebebi buydu:
 * eşik çok düşüktü, sıradan bir dokunuştaki birkaç piksellik kayma "sürükleme"
 * sayılıyor, pointer yakalanıyor ve tıklama olayı hiç doğmuyordu.
 *
 * Kural: emin olmadıkça ÜSTLENME.
 */
describe("jest kararı", () => {
  it("kaymasız dokunuş belirsizdir (tıklama yaşar)", () => {
    expect(jestKarari(0, 0)).toBe("belirsiz");
  });

  it("parmak titremesi seviyesindeki kayma sürükleme sayılmaz", () => {
    const ornekler: Array<[number, number]> = [
      [3, 0],
      [8, 2],
      [12, 3], // eski 10 px eşiğinde "yatay" sayılıyordu → tıklama kaybolurdu
      [0, 9],
      [11, 11],
      [15, 1],
    ];
    for (const [dx, dy] of ornekler) {
      expect(jestKarari(dx, dy), `(${dx},${dy})`).toBe("belirsiz");
    }
  });

  it("belirgin ve baskın yatay hareket sürüklemedir", () => {
    expect(jestKarari(20, 2)).toBe("yatay");
    expect(jestKarari(-40, 5)).toBe("yatay");
    expect(jestKarari(120, 30)).toBe("yatay");
  });

  it("belirgin dikey hareket tarayıcıya bırakılır", () => {
    expect(jestKarari(2, 20)).toBe("dikey");
    expect(jestKarari(10, -40)).toBe("dikey");
  });

  it("köşegen hareket yatay sayılmaz (baskınlık oranı)", () => {
    expect(jestKarari(20, 18)).toBe("belirsiz");
    expect(jestKarari(18, 25)).toBe("dikey");
  });

  it("eşik ve oran ayarlanabilir", () => {
    expect(jestKarari(12, 1, 10, 1.5)).toBe("yatay");
    expect(jestKarari(12, 1, 30, 1.5)).toBe("belirsiz");
  });
});
