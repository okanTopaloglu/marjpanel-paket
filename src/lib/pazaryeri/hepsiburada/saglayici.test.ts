import { describe, it, expect } from "vitest";
import { hepsiburadaSaglayicisi } from "./saglayici";
import { PAKET_SAYFA_BOYUTU, hbTarih } from "./istemci";
import { paketNormalle } from "./esle";

const KIMLIK = {
  merchantId: "b2910839-83b9-4d45-adb6-86bad457edcb",
  serviceKey: "servis-anahtari",
  entegratorAdi: "MamaAuraPaket",
};

const json = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { "content-type": "application/json" } });

const PAKET = {
  id: "p-1",
  packageNumber: "1234567890",
  barcode: "HB-BARKOD-1",
  status: "Packaged",
  cargoCompany: "HepsiJet",
  orderDate: "2026-09-01T10:00:00",
  recipientName: "Ayşe Yılmaz",
  phoneNumber: "05321112233",
  shippingAddressDetail: "Örnek Sk. No:1",
  shippingDistrict: "Merkez Mah.",
  shippingTown: "Kadıköy",
  shippingCity: "İstanbul",
  identityNo: "11111111111",
  items: [
    { orderNumber: "S-1", productBarcode: "869", productName: "Krem", quantity: 2, merchantSku: "SKU-1" },
    { orderNumber: "S-2", merchantSku: "SKU-2", productName: "Şampuan", quantity: 1 },
  ],
};

describe("hepsiburadaSaglayicisi", () => {
  it("Basic auth kullanıcı adı merchantId, User-Agent entegratör adı BİREBİR; tarih TR saatiyle yyyy-MM-dd HH:mm", async () => {
    let basliklar: Record<string, string> = {};
    let url = "";
    const s = hepsiburadaSaglayicisi(KIMLIK, {
      fetchImpl: async (u, init) => {
        url = u;
        basliklar = init?.headers as Record<string, string>;
        return json([PAKET]);
      },
    });
    const bas = Date.UTC(2026, 8, 1, 21, 0); // 00:00 TR
    await s.siparisler({ baslangic: bas, bitis: bas + 3_600_000, imlec: null });
    expect(basliklar.Authorization).toBe(
      `Basic ${Buffer.from(`${KIMLIK.merchantId}:${KIMLIK.serviceKey}`).toString("base64")}`,
    );
    expect(basliklar["User-Agent"]).toBe("MamaAuraPaket");
    expect(url).toContain(`/packages/merchantid/${KIMLIK.merchantId}`);
    expect(url).toContain(`begindate=${encodeURIComponent("2026-09-02 00:00")}`);
    expect(url).toContain(`limit=${PAKET_SAYFA_BOYUTU}&Offset=0`);
  });

  it("paket → normal: kimlik packageNumber, takip barcode, ilçe town, kalem barkodu productBarcode||merchantSku", () => {
    const n = paketNormalle(PAKET)!;
    expect(n.platform).toBe("hepsiburada");
    expect(n.siparisKimligi).toBe("1234567890");
    expect(n.siparisNo).toBe("S-1");
    expect(n.kargoTakipNo).toBe("HB-BARKOD-1");
    expect(n.kargoFirmasi).toBe("HepsiJet");
    expect(n.durum).toBe("Picking");
    expect(n.hamDurum).toBe("Packaged");
    expect(n.adres).toEqual({ acik: "Örnek Sk. No:1 Merkez Mah.", ilce: "Kadıköy", il: "İstanbul", telefon: "05321112233" });
    expect(n.kalemler).toEqual([
      { barkod: "869", urunAdi: "Krem", adet: 2, sku: "SKU-1" },
      { barkod: "SKU-2", urunAdi: "Şampuan", adet: 1, sku: "SKU-2" },
    ]);
    expect((n.ham._hb as { siparisNumaralari: string[] }).siparisNumaralari).toEqual(["S-1", "S-2"]);
    // İşaretsiz TR saati UTC'ye çevrilir.
    expect(n.siparisTarihi?.toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(paketNormalle({})).toBeNull();
  });

  it("offset imleci: dolu sayfa → +10, dolmamış → null; zarflı yanıt da kabul edilir", async () => {
    const dolu = Array.from({ length: PAKET_SAYFA_BOYUTU }, (_, i) => ({ ...PAKET, packageNumber: `P${i}` }));
    let cagri = 0;
    const s = hepsiburadaSaglayicisi(KIMLIK, {
      fetchImpl: async () => json(cagri++ === 0 ? dolu : { items: [PAKET] }),
    });
    const ilk = await s.siparisler({ baslangic: 0, bitis: 1, imlec: null });
    expect(ilk.kayitlar).toHaveLength(10);
    expect(ilk.sonrakiImlec).toBe("10");
    const son = await s.siparisler({ baslangic: 0, bitis: 1, imlec: "10" });
    expect(son.kayitlar).toHaveLength(1);
    expect(son.sonrakiImlec).toBeNull();
  });

  it("durum eşlemesi: Shipped, Cancelled, Unpacked→Cancelled, bilinmeyen→Created", () => {
    const d = (status: string) => paketNormalle({ packageNumber: "1", status })!.durum;
    expect(d("Shipped")).toBe("Shipped");
    expect(d("InTransit")).toBe("Shipped");
    expect(d("CancelledByMerchant")).toBe("Cancelled");
    expect(d("Unpacked")).toBe("Cancelled");
    expect(d("Delivered")).toBe("Delivered");
  });

  it("ürünler: mpop zarfı data[] + last; images dizisi", async () => {
    const s = hepsiburadaSaglayicisi(KIMLIK, {
      fetchImpl: async (u) => {
        expect(u).toContain("/api/products/all-products-of-merchant/");
        return json({
          success: true,
          totalPages: 1,
          last: true,
          data: [
            { merchantSku: "SKU-1", barcode: "869", productName: "Krem", brand: "MAMA AURA", images: ["https://x/1.jpg"], categoryName: "Bakım" },
            { merchantSku: "SKU-9", productName: "Barkodsuz" },
            { productName: "Hiçbiri yok" },
          ],
        });
      },
    });
    const u = await s.urunler!({ imlec: null });
    expect(u.kayitlar.map((k) => k.barkod)).toEqual(["869", "SKU-9"]);
    expect(u.kayitlar[0]).toMatchObject({ urunAdi: "Krem", marka: "MAMA AURA", gorselUrl: "https://x/1.jpg", stokKodu: "SKU-1" });
    expect(u.sonrakiImlec).toBeNull();
  });

  it("bağlantı testi 401'de üç sebebi söyler; sandbox SIT adresine gider", async () => {
    let url = "";
    const s = hepsiburadaSaglayicisi(KIMLIK, {
      ayarlar: { sandbox: true },
      fetchImpl: async (u) => {
        url = u;
        return new Response("", { status: 401 });
      },
    });
    const t = await s.baglantiTest();
    expect(t.ok).toBe(false);
    expect(t.mesaj).toMatch(/User-Agent/);
    expect(url).toContain("oms-external-sit.hepsiburada.com");
  });

  it("hbTarih Türkiye saatine çevirir", () => {
    expect(hbTarih(Date.UTC(2026, 0, 1, 21, 5))).toBe("2026-01-02 00:05");
  });
});
