const shouldRun = process.env.VERCEL_ENV === "preview" && process.env.SM_RUN_MIGRATIONS === "1";

if (!shouldRun) {
  console.log("[migrate-db] skipped (set VERCEL_ENV=preview and SM_RUN_MIGRATIONS=1 to run)");
  process.exit(0);
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("[migrate-db] missing Turso env vars");
  process.exit(1);
}

async function run() {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const { migrate } = await import("drizzle-orm/libsql/migrator");

  const client = createClient({ url, authToken });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("[migrate-db] migrations complete");
}

run().catch((error) => {
  console.error("[migrate-db] failed", error?.message || "unknown error");
  process.exit(1);
});
