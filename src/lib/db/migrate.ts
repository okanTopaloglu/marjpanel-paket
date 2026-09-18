/**
 * Migration uygulayıcı: `pnpm db:migrate`.
 * drizzle/ klasöründeki SQL migration'larını sırayla uygular.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL tanımlı değil.");
}

async function main() {
  // Migration için tek bağlantı yeterli.
  const migrationClient = postgres(connectionString!, { max: 1 });
  const db = drizzle(migrationClient);
  console.log("Migration'lar uygulanıyor...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migration'lar tamamlandı.");
  await migrationClient.end();
}

main().catch((err) => {
  console.error("Migration hatası:", err);
  process.exit(1);
});
