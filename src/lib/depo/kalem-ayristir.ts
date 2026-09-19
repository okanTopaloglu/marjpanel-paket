/**
 * MAL KABUL KALEM AYRIŞTIRMA — saf.
 *
 * Yapıştırılan metin (Excel'den kopyalanan iki sütun, ya da "barkod adet"
 * satırları) fiş kalemlerine çevrilir. Ayraç sekme, noktalı virgül, virgül ya
 * da boşluk; adet yoksa 1. Aynı barkod tekrar ederse adetler TOPLANIR —
 * depo aynı ürünü iki koliden sayarken iki satır yazar.
 */
export interface KalemGirdisi {
  barkod: string;
  adet: number;
}

export interface AyristirmaSonucu {
  kalemler: KalemGirdisi[];
  /** Satır numarası (1 tabanlı) → neden atlandı. */
  hatalar: { satir: number; metin: string; neden: string }[];
}

const AYRAC = /[\t;,]+|\s{1,}/;

export function kalemleriAyristir(metin: string, { isaretli = false }: { isaretli?: boolean } = {}): AyristirmaSonucu {
  const kalemler = new Map<string, number>();
  const hatalar: AyristirmaSonucu["hatalar"] = [];

  metin.split(/\r?\n/).forEach((ham, i) => {
    const satir = ham.trim();
    if (!satir) return;
    const parcalar = satir.split(AYRAC).filter(Boolean);
    const barkod = parcalar[0] ?? "";
    const adetMetni = parcalar[1] ?? "1";
    if (!/^[A-Za-z0-9._\-]+$/.test(barkod)) {
      hatalar.push({ satir: i + 1, metin: satir, neden: "Barkod geçersiz." });
      return;
    }
    const adet = Number(adetMetni.replace(",", "."));
    if (!Number.isInteger(adet) || adet === 0 || (!isaretli && adet < 0)) {
      hatalar.push({
        satir: i + 1,
        metin: satir,
        neden: isaretli ? "Adet sıfırdan farklı tam sayı olmalı." : "Adet pozitif tam sayı olmalı.",
      });
      return;
    }
    kalemler.set(barkod, (kalemler.get(barkod) ?? 0) + adet);
  });

  return {
    kalemler: [...kalemler.entries()].map(([barkod, adet]) => ({ barkod, adet })),
    hatalar,
  };
}

/** Form satırlarını (JSON) aynı kurallarla doğrular ve birleştirir. */
export function satirlariBirlestir(
  satirlar: { barkod: unknown; adet: unknown }[],
  { isaretli = false }: { isaretli?: boolean } = {},
): AyristirmaSonucu {
  const metin = satirlar
    .map((s) => `${String(s.barkod ?? "").trim()}\t${String(s.adet ?? "").trim()}`)
    .filter((s) => s !== "\t")
    .join("\n");
  return kalemleriAyristir(metin, { isaretli });
}
