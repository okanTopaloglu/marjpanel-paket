import { describe, expect, it } from "vitest";
import { sonAdminKorumasiIhlaliMi } from "../kullanici-kurallari";

describe("sonAdminKorumasiIhlaliMi", () => {
  it("hedef zaten aktif admin değilse hiçbir zaman ihlal sayılmaz", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: false,
        digerAktifAdminSayisi: 0,
        yeniRol: "calisan",
        yeniAktif: false,
      }),
    ).toBe(false);
  });

  it("başka aktif admin varsa rol düşürme serbest", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 1,
        yeniRol: "calisan",
      }),
    ).toBe(false);
  });

  it("son admin rolden düşürülemez", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
        yeniRol: "calisan",
      }),
    ).toBe(true);
  });

  it("son admin pasifleştirilemez", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
        yeniAktif: false,
      }),
    ).toBe(true);
  });

  it("son admin silinirken de aynı kural işler (yeniAktif: false ile modellenir)", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
        yeniAktif: false,
      }),
    ).toBe(true);
  });

  it("rol admin olarak kalıp yalnız aktif true'ya ayarlanırsa ihlal yok", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
        yeniRol: "admin",
        yeniAktif: true,
      }),
    ).toBe(false);
  });

  it("ne rol ne aktif değişiyorsa (örn. yalnız ad güncelleniyor) ihlal yok", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
      }),
    ).toBe(false);
  });

  it("son yönetici super_admin'e yükseltilirken koruma devreye girmez (yönetim yetkisi korunur)", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
        yeniRol: "super_admin",
      }),
    ).toBe(false);
  });

  it("son yönetici çalışana düşürülemez", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 0,
        yeniRol: "calisan",
      }),
    ).toBe(true);
  });

  it("başka aktif admin varsa super_admin'e yükseltme serbest", () => {
    expect(
      sonAdminKorumasiIhlaliMi({
        hedefSuAnAktifAdminMi: true,
        digerAktifAdminSayisi: 1,
        yeniRol: "super_admin",
      }),
    ).toBe(false);
  });
});
