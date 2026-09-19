"use server";

import { panelKapsami } from "@/lib/auth/yetki";
import {
  atamaTamamla as atamaTamamlaRepo,
  atamalarim,
  atamalariBirak as atamalariBirakRepo,
  kargoFirmalari,
  paketAta as paketAtaRepo,
  type AtamaListesi,
  type AtamaSonucu,
  type KargoSecenegi,
  type TamamlamaSonucu,
} from "@/lib/db/repos/atama";
import { barkodDogrula } from "@/lib/okut/sonuc";

/**
 * TOPLAMA MODU EYLEMLERİ.
 *
 * Hepsi aynı zarfı döner: `{ ok: true, ... }` ya da `{ ok: false, hata }`.
 * Yetkisizlik ve doğrulama birer VERİdir - toplama ekranı bir depo
 * terminalinde açıktır, hata sınırına düşüp ekranı boşaltmak orada
 * "uygulama çöktü" demektir.
 *
 * Kapsam her çağrıda tazedir; şirket ve kullanıcı kimliği yalnız oradan
 * gelir (istemci sipariş kimliği gönderebilir, şirket kimliği GÖNDEREMEZ).
 */

export type KargoFirmalariCevabi =
  | { ok: true; firmalar: KargoSecenegi[] }
  | { ok: false; hata: string };

export type AtamaCevabi =
  | { ok: true; sonuc: AtamaSonucu }
  | { ok: false; hata: string };

export type AtamalarimCevabi =
  | { ok: true; liste: AtamaListesi }
  | { ok: false; hata: string };

export type BirakmaCevabi =
  | { ok: true; birakilan: number }
  | { ok: false; hata: string };

export type TamamlamaCevabi =
  | { ok: true; sonuc: TamamlamaSonucu }
  | { ok: false; hata: string };

const OTURUM_HATASI = "Oturumunuz sona ermiş. Yeniden giriş yapın.";

/** Havuzdaki paketlerin kargo firması kırılımı (toplama modunun ilk adımı). */
export async function kargoFirmalariGetir(): Promise<KargoFirmalariCevabi> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, hata: OTURUM_HATASI };
  return { ok: true, firmalar: await kargoFirmalari(kapsam.sirketId) };
}

/** Seçilen kargo firmasından bir paket grubu üstlenir. */
export async function paketAta(kargoFirmasi: string): Promise<AtamaCevabi> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, hata: OTURUM_HATASI };

  const firma = (kargoFirmasi ?? "").trim();
  if (!firma) return { ok: false, hata: "Kargo firması seçin." };

  return { ok: true, sonuc: await paketAtaRepo(kapsam, firma) };
}

/** Çalışanın üstündeki paketler + gruplu toplama listesi. */
export async function atamalarimGetir(): Promise<AtamalarimCevabi> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, hata: OTURUM_HATASI };
  return { ok: true, liste: await atamalarim(kapsam) };
}

/** Kalan paketleri havuza geri verir. */
export async function atamalariBirak(): Promise<BirakmaCevabi> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, hata: OTURUM_HATASI };
  return { ok: true, birakilan: await atamalariBirakRepo(kapsam) };
}

/** Gösterilen siparişin kargo barkodu okutuldu: hazır işaretle + paket kaydı. */
export async function atamaTamamla(
  siparisId: string,
  barkod: string,
): Promise<TamamlamaCevabi> {
  const kapsam = await panelKapsami();
  if (!kapsam) return { ok: false, hata: OTURUM_HATASI };

  const id = (siparisId ?? "").trim();
  if (!id) return { ok: false, hata: "Sipariş seçili değil." };

  const dogrulama = barkodDogrula(barkod);
  if (!dogrulama.ok) return { ok: false, hata: dogrulama.hata };

  return { ok: true, sonuc: await atamaTamamlaRepo(kapsam, id, dogrulama.barkod) };
}
