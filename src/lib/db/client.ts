import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL tanımlı değil. .env dosyanızı kontrol edin.");
}

/**
 * postgres.js istemcisi.
 * Önemli: numeric sütunlar STRING olarak döner (hassasiyet korunur).
 * Geliştirmede HMR sırasında bağlantı sızıntısını önlemek için global cache.
 */
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { client, schema };
export type DB = typeof db;
