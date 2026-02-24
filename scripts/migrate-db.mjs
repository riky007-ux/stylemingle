const vercelEnv = process.env.VERCEL_ENV || "(unset)";
const runFlag = process.env.SM_RUN_MIGRATIONS || "(unset)";
const shouldRun = vercelEnv === "preview" && runFlag === "1";

console.log(`[migrate-db] env check VERCEL_ENV=${vercelEnv} SM_RUN_MIGRATIONS=${runFlag}`);

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
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("[migrate-db] drizzle migrations complete");
    return;
  } catch (error) {
    const message = String(error?.message || "unknown error");
    if (!message.includes("already exists")) {
      throw error;
    }

    console.log("[migrate-db] baseline schema already exists, applying Gate 10.2 compatibility migration");
    await ensureGate102Schema(client);
    console.log("[migrate-db] Gate 10.2 compatibility migration complete");
  }
}

async function columnExists(client, table, column) {
  const result = await client.execute(`PRAGMA table_info(${table});`);
  return (result.rows || []).some((row) => row?.name === column);
}

async function tableExists(client, table) {
  const result = await client.execute({
    sql: "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
    args: [table],
  });
  return (result.rows || []).length > 0;
}

async function ensureColumn(client, table, column, sqlType) {
  if (!(await columnExists(client, table, column))) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType};`);
    console.log(`[migrate-db] added ${table}.${column}`);
  }
}

async function ensureGate102Schema(client) {
  await ensureColumn(client, "wardrobe_items", "primaryColor", "TEXT");
  await ensureColumn(client, "wardrobe_items", "styleTag", "TEXT");

  if (!(await tableExists(client, "avatar_preferences"))) {
    await client.execute(`
      CREATE TABLE avatar_preferences (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL UNIQUE,
        gender TEXT NOT NULL,
        skinToneKey TEXT NOT NULL,
        hairStyleKey TEXT NOT NULL,
        hairColorKey TEXT NOT NULL,
        faceStyleKey TEXT NOT NULL,
        bodySize TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `);
    console.log("[migrate-db] created avatar_preferences");
  }

  await ensureColumn(client, "outfits", "promptJson", "TEXT");
  await ensureColumn(client, "outfits", "explanation", "TEXT");
}

run().catch((error) => {
  console.error("[migrate-db] failed", error?.message || "unknown error");
  process.exit(1);
});
