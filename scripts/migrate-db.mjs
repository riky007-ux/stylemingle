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

function isIgnorableSqlError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("already exists") || message.includes("duplicate column");
}

async function executeSafe(client, sql, actionLabel) {
  try {
    await client.execute(sql);
    if (actionLabel) {
      console.log(`[migrate-db] ${actionLabel}`);
    }
  } catch (error) {
    if (!isIgnorableSqlError(error)) {
      throw error;
    }
    if (actionLabel) {
      console.log(`[migrate-db] ${actionLabel} (already present)`);
    }
  }
}

async function tableExists(client, tableName) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
    args: [tableName],
  });
  return (result.rows || []).length > 0;
}

async function getColumns(client, tableName) {
  const result = await client.execute(`PRAGMA table_info(${tableName});`);
  return (result.rows || []).map((row) => String(row?.name || ""));
}

async function columnExists(client, tableName, columnName) {
  if (!(await tableExists(client, tableName))) {
    return false;
  }
  const columns = await getColumns(client, tableName);
  return columns.includes(columnName);
}

async function ensureColumn(client, tableName, columnName, sqlType) {
  if (await columnExists(client, tableName, columnName)) {
    console.log(`[migrate-db] already present ${tableName}.${columnName}`);
    return;
  }

  await executeSafe(
    client,
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType};`,
    `added ${tableName}.${columnName}`,
  );
}

async function ensureAvatarPreferencesTable(client) {
  if (await tableExists(client, "avatar_preferences")) {
    console.log("[migrate-db] already present avatar_preferences");
    return;
  }

  await executeSafe(
    client,
    `
      CREATE TABLE IF NOT EXISTS avatar_preferences (
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
    `,
    "created avatar_preferences",
  );
}

async function ensureOutfitsTable(client) {
  if (await tableExists(client, "outfits")) {
    console.log("[migrate-db] outfits already exists");
    return;
  }

  await executeSafe(
    client,
    `
      CREATE TABLE IF NOT EXISTS outfits (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        itemIds TEXT NOT NULL,
        promptJson TEXT,
        explanation TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `,
    "created outfits",
  );
}

async function ensureGate102Schema(client) {
  await ensureColumn(client, "wardrobe_items", "category", "TEXT");
  await ensureColumn(client, "wardrobe_items", "primaryColor", "TEXT");
  await ensureColumn(client, "wardrobe_items", "styleTag", "TEXT");

  await ensureAvatarPreferencesTable(client);
  await ensureOutfitsTable(client);
  await ensureColumn(client, "outfits", "promptJson", "TEXT");
  await ensureColumn(client, "outfits", "explanation", "TEXT");
}

run().catch((error) => {
  console.error("[migrate-db] failed", error?.message || "unknown error");
  process.exit(1);
});
