// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { IslemMaddesi } from "@/components/panel/islemler-menusu";

/**
 * Regresyon: mobilde İşlemler menüsü maddeleri hiç çalışmıyordu.
 *
 * KÖK NEDEN: menünün dışarı-tıklama (`pointerdown`) dinleyicisi `acik`e bağlı
 * bağlanıyordu ve mobil/masaüstü ayrımı yapmıyordu. Mobilde menü `MobilSheet`
 * ile document.body'ye AYRI bir portalda çizilir; `sarmalRef`/`menuRef` o
 * portala bağlı değildir. Sonuç: sheet içindeki her dokunuş "dışarı tıklama"
 * sayılıp `setAcik(false)` çalışıyor, hemen ardından gelen click ise
 * MobilSheet'in `onClickCapture`'ı (`!acikRef.current` iken
 * preventDefault+stopPropagation) tarafından yutuluyordu — madde `onSelect`
 * HİÇ tetiklenmiyordu. Düzeltme: dışarı-tıklama ve kaydırma/resize kapanışı
 * yalnız masaüstünde bağlanıyor.
 *
 * `MobilSheet` gerçek sürüklenebilir/spring animasyonlu bileşen olduğu için
 * burada basit bir geçit (children'ı doğrudan çizen) mock ile değiştirilir —
 * testin amacı dinleyici mantığıdır, sheet'in kendi jestleri değil.
 */

vi.mock("@/components/ui/mobil-sheet", async () => {
  const { createPortal } = await import("react-dom");
  return {
    // Gerçek MobilSheet document.body'ye AYRI bir portalla çizilir — mock da
    // bunu taklit ETMELİDİR, yoksa test `sarmalRef` div'inin İÇİNDE kalır ve
    // "dışarı tıklama" hiç tetiklenmeden regresyonu maskeler (bu commit'te
    // gerçekten yaşandı: portalsız mock testi hep yeşil gösteriyordu).
    MobilSheet: ({
      acik,
      children,
    }: {
      acik: boolean;
      children: React.ReactNode;
    }) =>
      acik
        ? createPortal(
            <div data-testid="mobil-sheet">{children}</div>,
            document.body,
          )
        : null,
  };
});

const masaustuMock = vi.fn();
vi.mock("@/lib/hooks/medya", () => ({
  useMasaustu: () => masaustuMock(),
}));

// jsdom yerleşim ölçmez: `offsetHeight` her zaman 0'dır. Masaüstü menüsü
// konumunu bu değere göre hesaplayıp hesaplanana kadar `visibility:hidden`
// tutuyor (bkz. islemler-menusu.tsx useLayoutEffect) — testte gerçek bir
// yükseklik olmadan menü hiç görünür olmazdı. Testin amacı dinleyici mantığı
// olduğundan gerçekçi bir sabit yükseklik veriyoruz.
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 200,
});

async function menuYukle() {
  const mod = await import("@/components/panel/islemler-menusu");
  return mod.IslemlerMenusu;
}

function maddelerOlustur(onSelect: () => void): IslemMaddesi[] {
  return [
    {
      key: "test",
      etiket: "Test eylemi",
      onSelect,
    },
  ];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IslemlerMenusu", () => {
  it("mobilde: sheet içindeki maddeye dokunuş onSelect'i tetikler", async () => {
    masaustuMock.mockReturnValue(false);
    const onSelect = vi.fn();
    const IslemlerMenusu = await menuYukle();

    render(<IslemlerMenusu maddeler={maddelerOlustur(onSelect)} />);

    fireEvent.click(screen.getByRole("button", { name: "İşlemler" }));

    const sheet = await screen.findByTestId("mobil-sheet");
    const madde = await screen.findByRole("button", { name: "Test eylemi" });
    expect(sheet.contains(madde)).toBe(true);

    // Gerçek kullanıcı etkileşimi pointerdown'ı click'ten önce üretir.
    fireEvent.pointerDown(madde);
    fireEvent.click(madde);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("masaüstünde: menü dışına pointerdown menüyü kapatır", async () => {
    masaustuMock.mockReturnValue(true);
    const onSelect = vi.fn();
    const IslemlerMenusu = await menuYukle();

    render(<IslemlerMenusu maddeler={maddelerOlustur(onSelect)} />);

    fireEvent.click(screen.getByRole("button", { name: "İşlemler" }));
    expect(await screen.findByRole("menu")).toBeTruthy();

    // Menünün ve tetikleyicinin dışında bir nokta.
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("masaüstünde: menü içindeki maddeye tıklama onSelect'i tetikler ve kapatır", async () => {
    masaustuMock.mockReturnValue(true);
    const onSelect = vi.fn();
    const IslemlerMenusu = await menuYukle();

    render(<IslemlerMenusu maddeler={maddelerOlustur(onSelect)} />);

    fireEvent.click(screen.getByRole("button", { name: "İşlemler" }));
    const madde = await screen.findByRole("button", { name: "Test eylemi" });

    fireEvent.pointerDown(madde);
    fireEvent.click(madde);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
