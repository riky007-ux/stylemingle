import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "fs";
import path from "path";

import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type PremiumColumnName = "isPremium" | "is_premium" | null;

type JournalSummary = {
  entryCount: number;
  lastTag: string | null;
};

type Gate12State = {
  hasIsPremium: boolean;
  detectedPremiumColumnName: PremiumColumnName;
  hasStyleProfileTable: boolean;
  hasFeedbackTable: boolean;
  hasFeedbackColumns: boolean;
  tables: string[];
};

function gateReady(state: Gate12State) {
  return state.hasIsPremium && state.hasStyleProfileTable && state.hasFeedbackColumns;
}

function blockingReasons(state: Gate12State) {
  const reasons: string[] = [];
  if (!state.hasIsPremium) reasons.push("MISSING_PREMIUM_COLUMN");
  if (!state.hasStyleProfileTable) reasons.push("MISSING_STYLE_PROFILE_SCHEMA");
  if (!state.hasFeedbackColumns) reasons.push("MISSING_FEEDBACK_COLUMNS");
  return reasons;
}

function jsonWithStatus(status: number, body: Record<string, unknown>) {
  return NextResponse.json({ httpStatus: status, ...body }, { status });
}

function endpointEnabled() {
  return process.env.VERCEL_ENV !== "production" || process.env.ALLOW_DEV_MIGRATE_ENDPOINT === "true";
}

function safeTrim(value: unknown, max = 180) {
  return String(value || "").replace(/\s+/g, " ").slice(0, max);
}

function makeDbFingerprint() {
  const rawUrl = process.env.TURSO_DATABASE_URL || "";
  let dbHost = "unknown";
  let dbNameHint = "unknown";

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      dbHost = parsed.host || "unknown";
      const pathName = (parsed.pathname || "").replace(/^\/+/, "");
      const basis = pathName || parsed.host || "unknown";
      dbNameHint = basis.slice(-6) || "unknown";
    } catch {
      dbHost = "invalid-url";
      dbNameHint = rawUrl.slice(-6) || "unknown";
    }
  }

  return {
    dbHost,
    dbNameHint,
    envPresent: {
      hasTursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
      hasTursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
    },
  };
}

function buildInfo() {
  return {
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  };
}

function authCheck(req: Request) {
  if (!endpointEnabled()) return { error: jsonWithStatus(404, { ok: false, code: "NOT_FOUND", message: "Endpoint disabled in production" }) };

  const userId = getUserIdFromRequest(req);
  if (!userId) return { error: jsonWithStatus(401, { ok: false, code: "NOT_AUTHENTICATED", message: "You must be logged in" }) };

  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  if (!expectedToken) return { error: jsonWithStatus(503, { ok: false, code: "ADMIN_TOKEN_NOT_CONFIGURED", message: "Admin token not configured" }) };

  const providedToken = req.headers.get("x-stylemingle-admin-token") || "";
  if (!providedToken) return { error: jsonWithStatus(403, { ok: false, code: "ADMIN_TOKEN_MISSING", message: "Admin token header is required" }) };
  if (providedToken !== expectedToken) return { error: jsonWithStatus(403, { ok: false, code: "INVALID_ADMIN_TOKEN", message: "Admin token is invalid" }) };

  return { userId };
}

function listMigrationFiles(migrationsFolder: string) {
  const all = fs.existsSync(migrationsFolder) ? fs.readdirSync(migrationsFolder) : [];
  const sqlFiles = all.filter((name) => /^\d+.*\.sql$/i.test(name)).sort();
  return { allFiles: all, sqlFiles };
}

function readJournalSummary(journalPath: string): JournalSummary {
  try {
    const parsed = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const last = entries.length > 0 ? entries[entries.length - 1] : null;
    return {
      entryCount: entries.length,
      lastTag: typeof last?.tag === "string" ? last.tag : null,
    };
  } catch {
    return { entryCount: 0, lastTag: null };
  }
}

async function readTables(client: ReturnType<typeof createClient>) {
  const tableRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC");
  const tables = (tableRes.rows || []).map((row: any) => String(row?.name || "")).filter(Boolean);
  return {
    tables,
    hasDrizzleMigrationsTable: tables.includes("__drizzle_migrations") || tables.some((table) => table.includes("drizzle") && table.includes("migration")),
  };
}

async function getTableColumns(client: ReturnType<typeof createClient>, table: string) {
  const result = await client.execute(`PRAGMA table_info(${table});`);
  return (result.rows || []).map((row: any) => String(row?.name || "")).filter(Boolean);
}

async function inspectGate12State(client: ReturnType<typeof createClient>): Promise<Gate12State> {
  const { tables } = await readTables(client);
  const usersColumns = tables.includes("users") ? await getTableColumns(client, "users").catch(() => [] as string[]) : [];
  const styleColumns = tables.includes("user_style_profile") ? await getTableColumns(client, "user_style_profile").catch(() => [] as string[]) : [];
  const ratingColumns = tables.includes("ratings") ? await getTableColumns(client, "ratings").catch(() => [] as string[]) : [];

  let detectedPremiumColumnName: PremiumColumnName = null;
  if (usersColumns.includes("isPremium")) detectedPremiumColumnName = "isPremium";
  if (!detectedPremiumColumnName && usersColumns.includes("is_premium")) detectedPremiumColumnName = "is_premium";

  const requiredStyle = ["userId", "styleVibes", "fitPreference", "comfortFashion", "colorsLove", "colorsAvoid", "climate", "budgetSensitivity", "updatedAt"];

  return {
    hasIsPremium: Boolean(detectedPremiumColumnName),
    detectedPremiumColumnName,
    hasStyleProfileTable: requiredStyle.every((c) => styleColumns.includes(c)),
    hasFeedbackTable: tables.includes("ratings"),
    hasFeedbackColumns: ratingColumns.includes("reasons") && ratingColumns.includes("note"),
    tables,
  };
}

async function ensurePremiumColumnsExist(client: ReturnType<typeof createClient>) {
  let forcedPremiumSchemaPatchApplied = false;
  const usersColumns = await getTableColumns(client, "users").catch(() => [] as string[]);

  if (!usersColumns.includes("isPremium")) {
    const changed = await client.execute('ALTER TABLE users ADD COLUMN "isPremium" INTEGER NOT NULL DEFAULT 0;').catch(() => null);
    if (changed) forcedPremiumSchemaPatchApplied = true;
  }

  if (!usersColumns.includes("is_premium")) {
    const changed = await client.execute("ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;").catch(() => null);
    if (changed) forcedPremiumSchemaPatchApplied = true;
  }

  await client.execute('UPDATE users SET is_premium = CASE WHEN "isPremium" IS NOT NULL AND "isPremium" != 0 THEN 1 ELSE 0 END;').catch(() => null);
  await client.execute('UPDATE users SET "isPremium" = CASE WHEN is_premium IS NOT NULL AND is_premium != 0 THEN 1 ELSE 0 END;').catch(() => null);

  return forcedPremiumSchemaPatchApplied;
}

async function ensureStyleProfileSchema(client: ReturnType<typeof createClient>) {
  let forcedStyleProfileSchemaPatchApplied = false;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_style_profile (
      userId TEXT PRIMARY KEY NOT NULL,
      styleVibes TEXT NOT NULL DEFAULT '[]',
      fitPreference TEXT,
      comfortFashion INTEGER NOT NULL DEFAULT 50,
      colorsLove TEXT NOT NULL DEFAULT '[]',
      colorsAvoid TEXT NOT NULL DEFAULT '[]',
      climate TEXT,
      budgetSensitivity TEXT,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `).catch(() => null);

  const addColumn = async (sql: string) => {
    const changed = await client.execute(sql).catch(() => null);
    if (changed) forcedStyleProfileSchemaPatchApplied = true;
  };

  const columns = await getTableColumns(client, "user_style_profile").catch(() => [] as string[]);
  if (!columns.includes("styleVibes")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN styleVibes TEXT NOT NULL DEFAULT '[]';");
  if (!columns.includes("fitPreference")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN fitPreference TEXT;");
  if (!columns.includes("comfortFashion")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN comfortFashion INTEGER NOT NULL DEFAULT 50;");
  if (!columns.includes("colorsLove")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN colorsLove TEXT NOT NULL DEFAULT '[]';");
  if (!columns.includes("colorsAvoid")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN colorsAvoid TEXT NOT NULL DEFAULT '[]';");
  if (!columns.includes("climate")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN climate TEXT;");
  if (!columns.includes("budgetSensitivity")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN budgetSensitivity TEXT;");
  if (!columns.includes("updatedAt")) await addColumn("ALTER TABLE user_style_profile ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;");

  return forcedStyleProfileSchemaPatchApplied;
}

async function ensureFeedbackSchema(client: ReturnType<typeof createClient>) {
  let forcedFeedbackSchemaPatchApplied = false;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY NOT NULL,
      outfitId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      reasons TEXT,
      note TEXT,
      FOREIGN KEY (outfitId) REFERENCES outfits(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `).catch(() => null);

  const columns = await getTableColumns(client, "ratings").catch(() => [] as string[]);
  if (!columns.includes("reasons")) {
    const changed = await client.execute("ALTER TABLE ratings ADD COLUMN reasons TEXT;").catch(() => null);
    if (changed) forcedFeedbackSchemaPatchApplied = true;
  }
  if (!columns.includes("note")) {
    const changed = await client.execute("ALTER TABLE ratings ADD COLUMN note TEXT;").catch(() => null);
    if (changed) forcedFeedbackSchemaPatchApplied = true;
  }

  return forcedFeedbackSchemaPatchApplied;
}

async function readDrizzleMigrations(client: ReturnType<typeof createClient>) {
  const { tables } = await readTables(client);
  const tableName = tables.find((n) => n === "__drizzle_migrations") || tables.find((n) => n.includes("drizzle") && n.includes("migration"));
  if (!tableName) return [] as string[];

  const rows = await client.execute(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 20`);
  return (rows.rows || []).map((row: any) => String(row.hash ?? row.checksum ?? row.name ?? row.id ?? row.rowid ?? "unknown")).filter(Boolean);
}

export async function POST(req: Request) {
  const auth = authCheck(req);
  if ("error" in auth) return auth.error;

  const dbFingerprint = makeDbFingerprint();
  const build = buildInfo();

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return jsonWithStatus(503, {
      ok: false,
      gate12Ready: false,
      blockingReasons: ["DB_NOT_CONFIGURED"],
      warnings: [],
      migrationErrorSummary: null,
      forcedPremiumSchemaPatchApplied: false,
      forcedStyleProfileSchemaPatchApplied: false,
      forcedFeedbackSchemaPatchApplied: false,
      before: null,
      after: null,
      dbMigrations: [],
      dbFingerprint,
      buildInfo: build,
    });
  }

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const { allFiles, sqlFiles } = listMigrationFiles(migrationsFolder);
  const journal = fs.existsSync(journalPath) ? readJournalSummary(journalPath) : { entryCount: 0, lastTag: null };

  if (!fs.existsSync(journalPath)) {
    const message = `Missing migrations journal at ${journalPath}. Add drizzle/** to Next output tracing.`;
    console.error(`ROOT_CAUSE: dev-migrate MIGRATIONS_ASSET_MISSING ${safeTrim(message)}`);
    return jsonWithStatus(500, {
      ok: false,
      gate12Ready: false,
      blockingReasons: ["MIGRATIONS_ASSET_MISSING"],
      warnings: [],
      migrationErrorSummary: message,
      forcedPremiumSchemaPatchApplied: false,
      forcedStyleProfileSchemaPatchApplied: false,
      forcedFeedbackSchemaPatchApplied: false,
      before: null,
      after: null,
      dbMigrations: [],
      filesSeen: allFiles,
      dbFingerprint,
      buildInfo: build,
    });
  }

  if (sqlFiles.length === 0 || journal.entryCount === 0) {
    const reason = sqlFiles.length === 0 ? "MIGRATIONS_NOT_FOUND" : "JOURNAL_MISMATCH";
    console.error(`ROOT_CAUSE: dev-migrate ${reason} sql=${sqlFiles.length} journal=${journal.entryCount}`);
    return jsonWithStatus(500, {
      ok: false,
      gate12Ready: false,
      blockingReasons: [reason],
      warnings: [],
      migrationErrorSummary: `sqlFiles=${sqlFiles.length}; journalEntries=${journal.entryCount}`,
      forcedPremiumSchemaPatchApplied: false,
      forcedStyleProfileSchemaPatchApplied: false,
      forcedFeedbackSchemaPatchApplied: false,
      before: null,
      after: null,
      dbMigrations: [],
      dbFingerprint,
      buildInfo: build,
    });
  }

  const client = createClient({ url, authToken });
  const drizzleDb = drizzle(client);
  const warnings: string[] = [];
  let migrationErrorSummary: string | null = null;

  const before = await inspectGate12State(client).catch(() => ({
    hasIsPremium: false,
    detectedPremiumColumnName: null,
    hasStyleProfileTable: false,
    hasFeedbackTable: false,
    hasFeedbackColumns: false,
    tables: [],
  } as Gate12State));

  try {
    await migrate(drizzleDb, { migrationsFolder });
  } catch (error) {
    const safeMessage = safeTrim((error as any)?.message || error);
    migrationErrorSummary = safeMessage;
    if (safeMessage.toLowerCase().includes("already exists")) {
      warnings.push("BASELINE_SCHEMA_DETECTED");
      console.warn(`WARN: dev-migrate BASELINE_SCHEMA_DETECTED ${safeMessage}`);
    } else {
      warnings.push("MIGRATOR_WARNING");
      console.warn(`WARN: dev-migrate MIGRATOR_WARNING ${safeMessage}`);
    }
  }

  const forcedPremiumSchemaPatchApplied = await ensurePremiumColumnsExist(client);
  const forcedStyleProfileSchemaPatchApplied = await ensureStyleProfileSchema(client);
  const forcedFeedbackSchemaPatchApplied = await ensureFeedbackSchema(client);

  const after = await inspectGate12State(client).catch(() => ({
    hasIsPremium: false,
    detectedPremiumColumnName: null,
    hasStyleProfileTable: false,
    hasFeedbackTable: false,
    hasFeedbackColumns: false,
    tables: [],
  } as Gate12State));

  const isReady = gateReady(after);
  const reasons = blockingReasons(after);
  const dbMigrations = await readDrizzleMigrations(client).catch(() => [] as string[]);

  const payload = {
    ok: isReady,
    gate12Ready: isReady,
    blockingReasons: reasons,
    warnings,
    migrationErrorSummary,
    forcedPremiumSchemaPatchApplied,
    forcedStyleProfileSchemaPatchApplied,
    forcedFeedbackSchemaPatchApplied,
    before,
    after,
    dbMigrations,
    dbFingerprint,
    buildInfo: build,
  };

  if (!isReady) {
    console.error(`ROOT_CAUSE: dev-migrate MIGRATIONS_DID_NOT_PRODUCE_GATE12_SCHEMA ${safeTrim(reasons.join(","))}`);
    return jsonWithStatus(500, payload);
  }

  return jsonWithStatus(200, payload);
}
