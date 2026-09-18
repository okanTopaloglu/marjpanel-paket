import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
console.log(await sql`select id, ad, telefon, rol, sirket_id from kullanicilar`);
console.log(await sql`select id, ad from sirketler`);
console.log((await sql`select table_name from information_schema.tables where table_schema='public'`).map(r=>r.table_name).join(","));
console.log("kurallar:", (await sql`select count(*)::int c from barkod_kurallari`)[0]);
await sql.end();
