import "dotenv/config";
import { verify } from "@node-rs/argon2";
import { client } from "@/lib/db/client";
import { telefonNormalize } from "@/lib/format/telefon";
import {
  girisBasarili,
  girisBasarisiz,
  kapsamIcinGetir,
  telefonlaGetir,
} from "@/lib/db/repos/kullanicilar";

async function main() {
  const telefon = telefonNormalize("05550000000");
  console.log("normalize:", telefon);
  if (!telefon) throw new Error("normalize basarisiz");

  const k = await telefonlaGetir(telefon);
  console.log("kullanici:", k ? { id: k.id, ad: k.ad, rol: k.rol, aktif: k.aktif, hataliDeneme: k.hataliDeneme, kilitBitis: k.kilitBitis } : null);
  if (!k) throw new Error("kullanici bulunamadi");

  console.log("dogru parola verify:", await verify(k.parolaHash, "admin123"));
  console.log("yanlis parola verify:", await verify(k.parolaHash, "yanlis"));

  await girisBasarisiz(k.id);
  const s1 = await telefonlaGetir(telefon);
  console.log("girisBasarisiz sonrasi hataliDeneme:", s1?.hataliDeneme);

  await girisBasarili(k.id);
  const s2 = await telefonlaGetir(telefon);
  console.log("girisBasarili sonrasi hataliDeneme:", s2?.hataliDeneme, "kilitBitis:", s2?.kilitBitis);

  const kap = await kapsamIcinGetir(k.id);
  console.log("kapsam:", JSON.stringify(kap, null, 2));

  await client.end();
}

main().catch(async (e) => {
  console.error("HATA:", e);
  await client.end();
  process.exit(1);
});
