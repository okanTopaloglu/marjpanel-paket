// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { FiltreGrubu } from "@/components/panel/filtre-cubugu";

/**
 * Regresyon: "Filtrele (N)" tek düğmesi masaüstünde tüm grupları tek panelde
 * saklıyordu — kullanıcı "ayrı ayrı gözüksün ama derli toplu dursun" dedi
 * (15.09.2026). Masaüstünde artık HER GRUP KENDİ HAPI + popover'ı; mobilde
 * eski "Filtrele (N)" + sheet AYNEN kalıyor.
 *
 * `MobilSheet` gerçek sürüklenebilir/spring animasyonlu bileşen olduğu için
 * burada `islemler-menusu.test.tsx`'teki gibi basit bir portal mock ile
 * değiştirilir.
 */

vi.mock("@/components/ui/mobil-sheet", async () => {
  const { createPortal } = await import("react-dom");
  return {
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

async function cubukYukle() {
  const mod = await import("@/components/panel/filtre-cubugu");
  return mod.FiltreCubugu;
}

function gruplarOlustur(): {
  gruplar: FiltreGrubu[];
  durumOnChange: ReturnType<typeof vi.fn>;
  kanalOnChange: ReturnType<typeof vi.fn>;
} {
  const durumOnChange = vi.fn();
  const kanalOnChange = vi.fn();
  const gruplar: FiltreGrubu[] = [
    {
      anahtar: "durum",
      baslik: "Durum",
      tip: "tekli",
      secenekler: [
        { deger: "satista", etiket: "Satışta" },
        { deger: "pasif", etiket: "Pasif" },
      ],
      deger: "satista",
      onChange: durumOnChange,
    },
    {
      anahtar: "kanal",
      baslik: "Kanal",
      tip: "coklu",
      secenekler: [
        { deger: "trendyol", etiket: "Trendyol" },
        { deger: "hepsiburada", etiket: "Hepsiburada" },
      ],
      deger: [],
      onChange: kanalOnChange,
    },
  ];
  return { gruplar, durumOnChange, kanalOnChange };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FiltreCubugu", () => {
  it("masaüstünde: her grup için ayrı hap çizilir", async () => {
    masaustuMock.mockReturnValue(true);
    const { gruplar } = gruplarOlustur();
    const FiltreCubugu = await cubukYukle();

    render(<FiltreCubugu gruplar={gruplar} />);

    // "Durum" hapı aktif (deger: "satista") → özet etiketi görünür.
    expect(
      screen.getByRole("button", { name: /Durum: Satışta/ }),
    ).toBeTruthy();
    // "Kanal" hapı pasif → başlık görünür.
    expect(screen.getByRole("button", { name: "Kanal" })).toBeTruthy();

    // Tek "Filtrele" düğmesi masaüstünde YOK.
    expect(screen.queryByRole("button", { name: /Filtrele/ })).toBeNull();
  });

  it("masaüstünde: hapa tıklayınca grup gövdesi (popover) görünür", async () => {
    masaustuMock.mockReturnValue(true);
    const { gruplar } = gruplarOlustur();
    const FiltreCubugu = await cubukYukle();

    render(<FiltreCubugu gruplar={gruplar} />);

    fireEvent.click(screen.getByRole("button", { name: "Kanal" }));

    const popover = await screen.findByRole("dialog", { name: "Kanal" });
    expect(popover).toBeTruthy();
    // Popover içinde grubun seçenekleri var.
    expect(
      screen.getByRole("button", { name: "Trendyol" }),
    ).toBeTruthy();
  });

  it("masaüstünde: ikinci hap açılınca ilki kapanır (tek popover)", async () => {
    masaustuMock.mockReturnValue(true);
    const { gruplar } = gruplarOlustur();
    const FiltreCubugu = await cubukYukle();

    render(<FiltreCubugu gruplar={gruplar} />);

    fireEvent.click(screen.getByRole("button", { name: /Durum/ }));
    expect(await screen.findByRole("dialog", { name: "Durum" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kanal" }));
    expect(await screen.findByRole("dialog", { name: "Kanal" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Durum" })).toBeNull();
  });

  it("masaüstünde: aktif grup hapı özet etiketi doğru gösterir (tekli ve çoklu)", async () => {
    masaustuMock.mockReturnValue(true);
    const { gruplar } = gruplarOlustur();
    // Kanal grubunu çoklu seçime çevir (iki seçim).
    const kanalGrubu = gruplar.find((g) => g.anahtar === "kanal");
    if (kanalGrubu?.tip === "coklu") kanalGrubu.deger = ["trendyol", "hepsiburada"];
    const FiltreCubugu = await cubukYukle();

    render(<FiltreCubugu gruplar={gruplar} />);

    expect(
      screen.getByRole("button", { name: /Durum: Satışta/ }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Kanal · 2/ })).toBeTruthy();
  });

  it("masaüstünde: Temizle yalnız aktif filtre varken görünür", async () => {
    masaustuMock.mockReturnValue(true);
    const onTemizle = vi.fn();
    const { gruplar } = gruplarOlustur();
    const FiltreCubugu = await cubukYukle();

    const { rerender } = render(
      <FiltreCubugu gruplar={gruplar} onTemizle={onTemizle} />,
    );
    // "durum" grubu zaten aktif (deger: "satista") → Temizle görünür.
    const temizleDugmesi = screen.getByRole("button", { name: "Temizle" });
    expect(temizleDugmesi).toBeTruthy();
    fireEvent.click(temizleDugmesi);
    expect(onTemizle).toHaveBeenCalledTimes(1);

    // Hiç aktif grup yokken Temizle görünmez.
    const pasifGruplar: FiltreGrubu[] = gruplar.map((g) =>
      g.tip === "tekli" ? { ...g, deger: "" } : g,
    );
    rerender(<FiltreCubugu gruplar={pasifGruplar} onTemizle={onTemizle} />);
    expect(screen.queryByRole("button", { name: "Temizle" })).toBeNull();
  });

  it("useMasaustu false iken (mobil): eski tek 'Filtrele' düğmesi çizilir", async () => {
    masaustuMock.mockReturnValue(false);
    const { gruplar } = gruplarOlustur();
    const FiltreCubugu = await cubukYukle();

    render(<FiltreCubugu gruplar={gruplar} />);

    // Aktif sayı 1 ("durum" grubu satista) → "Filtrele (1)".
    expect(
      screen.getByRole("button", { name: /Filtrele/ }),
    ).toBeTruthy();
    // Grup hapları mobilde YOK.
    expect(
      screen.queryByRole("button", { name: /Durum: Satışta/ }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Filtrele/ }));
    const sheet = await screen.findByTestId("mobil-sheet");
    expect(sheet).toBeTruthy();
  });
});
