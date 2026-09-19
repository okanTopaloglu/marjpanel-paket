/** Test yardımcıları — kayıt defterini içe aktarıp türetilmiş görünümler verir. */
import { PAZARYERLERI, kaynaktanPlatform, pazaryeriAdi, platformMi } from "../kayit";
import { PLATFORMLAR } from "../tipler";

export { PAZARYERLERI, kaynaktanPlatform, pazaryeriAdi, platformMi };

/** Yalnız hazır platformlar `{ anahtar: true }` olarak. */
export function PLATFORMLAR_HAZIR_MI(): Record<string, boolean> {
  const c: Record<string, boolean> = {};
  for (const p of PLATFORMLAR) if (PAZARYERLERI[p].hazir) c[p] = true;
  return c;
}
