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

function jsonError(status: number, code: string, message: string, extras: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extras }, { status });
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

function isAuthOrTokenInvalid(req: Request) {
  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  if (!expectedToken) {
    return { error: jsonError(503, "ADMIN_TOKEN_NOT_CONFIGURED", "Admin token not configured") };
  }

  const providedToken = req.headers.get("x-stylemingle-admin-token");
  if (!providedToken) {
    return { error: jsonError(403, "ADMIN_TOKEN_MISSING", "Admin token header is required") };
  }
  if (providedToken !== expectedToken) {
    return { error: jsonError(403, "INVALID_ADMIN_TOKEN", "Admin token is invalid") };
  }

  return { ok: true };
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

async function detectUsersPremiumSchema(client: ReturnType<typeof createClient>) {
  const result = await client.execute("PRAGMA table_info(users);");
  const columns = (result.rows || []).map((row: any) => String(row?.name || ""));
  let detectedPremiumColumnName: PremiumColumnName = null;
  if (columns.includes("isPremium")) detectedPremiumColumnName = "isPremium";
  if (!detectedPremiumColumnName && columns.includes("is_premium")) detectedPremiumColumnName = "is_premium";
  return {
    hasIsPremium: Boolean(detectedPremiumColumnName),
    detectedPremiumColumnName,
    columns,
  };
}

async function ensurePremiumColumnsExist(client: ReturnType<typeof createClient>) {
  const before = await detectUsersPremiumSchema(client);
  let forcedPremiumSchemaPatchApplied = false;

  const hasCamel = before.columns.includes("isPremium");
  const hasSnake = before.columns.includes("is_premium");

  if (!hasCamel) {
    await client.execute('ALTER TABLE users ADD COLUMN "isPremium" INTEGER NOT NULL DEFAULT 0;').catch(() => null);
    forcedPremiumSchemaPatchApplied = true;
  }

  if (!hasSnake) {
    await client.execute("ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;").catch(() => null);
    forcedPremiumSchemaPatchApplied = true;
  }

  await client.execute(`
    UPDATE users
    SET is_premium = CASE
      WHEN "isPremium" IS NOT NULL AND "isPremium" != 0 THEN 1
      ELSE 0
    END;
  `).catch(() => null);

  await client.execute(`
    UPDATE users
    SET "isPremium" = CASE
      WHEN is_premium IS NOT NULL AND is_premium != 0 THEN 1
      ELSE 0
    END;
  `).catch(() => null);

  const after = await detectUsersPremiumSchema(client);
  return { forcedPremiumSchemaPatchApplied, after };
}

async function readDrizzleMigrations(client: ReturnType<typeof createClient>) {
  const { tables } = await readTables(client);
  const tableName = tables.find((n) => n === "__drizzle_migrations") || tables.find((n) => n.includes("drizzle") && n.includes("migration"));
  if (!tableName) return [];

  const rows = await client.execute(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 20`);
  return (rows.rows || []).map((row: any) => ({
    id: row.id ?? row.rowid ?? null,
    hash: row.hash ?? row.checksum ?? row.name ?? null,
    createdAt: row.created_at ?? row.createdAt ?? row.created ?? null,
  }));
}

export async function POST(req: Request) {
  if (!endpointEnabled()) {
    return jsonError(404, "NOT_FOUND", "Endpoint disabled in production");
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return jsonError(401, "NOT_AUTHENTICATED", "You must be logged in");
  }

  const auth = isAuthOrTokenInvalid(req);
  if ("error" in auth) return auth.error;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const dbFingerprint = makeDbFingerprint();
  if (!url || !authToken) {
    return jsonError(503, "DB_NOT_CONFIGURED", "Database environment variables are not configured", { dbFingerprint });
  }

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    const message = `Missing migrations journal at ${journalPath}. Add drizzle/** to Next output tracing.`;
    console.error(`ROOT_CAUSE: dev-migrate MIGRATIONS_ASSET_MISSING ${safeTrim(message)}`);
    return jsonError(500, "MIGRATIONS_ASSET_MISSING", message, { dbFingerprint });
  }

  const { allFiles, sqlFiles } = listMigrationFiles(migrationsFolder);
  if (sqlFiles.length === 0) {
    return jsonError(500, "MIGRATIONS_NOT_FOUND", `No migration SQL files found under ${migrationsFolder}`, {
      migrationsFolder,
      filesSeen: allFiles,
      dbFingerprint,
    });
  }

  const journal = readJournalSummary(journalPath);
  if (journal.entryCount === 0 && sqlFiles.length > 0) {
    const message = "Migration journal has zero entries while SQL files exist. Check drizzle/meta/_journal.json consistency.";
    console.error(`ROOT_CAUSE: dev-migrate JOURNAL_MISMATCH ${safeTrim(message)}`);
    return jsonError(500, "JOURNAL_MISMATCH", message, {
      migrationFilesFound: sqlFiles.length,
      latestMigrationName: sqlFiles[sqlFiles.length - 1] || null,
      journal,
      dbFingerprint,
    });
  }

  const client = createClient({ url, authToken });
  const drizzleDb = drizzle(client);

  const beforeTablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const beforeTables = new Set((beforeTablesResult.rows || []).map((r: any) => String(r?.name || "")));

  const warnings: string[] = [];
  let migrationErrorSummary: string | null = null;

  try {
    await migrate(drizzleDb, { migrationsFolder });
  } catch (error) {
    const safeMessage = safeTrim((error as any)?.message || error);
    migrationErrorSummary = safeMessage;
    if (safeMessage.toLowerCase().includes("already exists")) {
      warnings.push("BASELINE_SCHEMA_DETECTED");
      console.warn(`ROOT_CAUSE: dev-migrate BASELINE_SCHEMA_DETECTED ${safeMessage}`);
    } else {
      console.error(`ROOT_CAUSE: dev-migrate MIGRATOR_FAILURE ${safeMessage}`);
    }
  }

  try {
    const afterTablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const afterTables = new Set((afterTablesResult.rows || []).map((r: any) => String(r?.name || "")));
    const applied = [...afterTables].filter((name) => name && !beforeTables.has(name));
    const alreadyUpToDate = applied.length === 0;

    const ensureResult = await ensurePremiumColumnsExist(client);
    const tablesInfo = await readTables(client);
    const dbMigrations = await readDrizzleMigrations(client);

    if (!ensureResult.after.hasIsPremium) {
      const message =
        "Migrations reported success but users premium column is still missing. Check DB target, permissions, and migration execution path.";
      console.error(`ROOT_CAUSE: dev-migrate MIGRATIONS_DID_NOT_PRODUCE_SCHEMA ${safeTrim(message)}`);
      return jsonError(500, "MIGRATIONS_DID_NOT_PRODUCE_SCHEMA", message, {
        migrationFilesFound: sqlFiles.length,
        latestMigrationName: sqlFiles[sqlFiles.length - 1] || null,
        journalEntriesCount: journal.entryCount,
        journal,
        tablesFound: tablesInfo.tables,
        hasDrizzleMigrationsTable: tablesInfo.hasDrizzleMigrationsTable,
        alreadyUpToDate,
        dbFingerprint,
        warnings,
        migrationErrorSummary,
        forcedPremiumSchemaPatchApplied: ensureResult.forcedPremiumSchemaPatchApplied,
        after: {
          hasIsPremium: ensureResult.after.hasIsPremium,
          detectedPremiumColumnName: ensureResult.after.detectedPremiumColumnName,
        },
        dbMigrations,
      });
    }

    return NextResponse.json({
      ok: true,
      applied,
      alreadyUpToDate,
      migrationFilesFound: sqlFiles.length,
      latestMigrationName: sqlFiles[sqlFiles.length - 1] || null,
      journal,
      tables: tablesInfo.tables,
      hasDrizzleMigrationsTable: tablesInfo.hasDrizzleMigrationsTable,
      warnings,
      migrationErrorSummary,
      forcedPremiumSchemaPatchApplied: ensureResult.forcedPremiumSchemaPatchApplied,
      after: {
        hasIsPremium: ensureResult.after.hasIsPremium,
        detectedPremiumColumnName: ensureResult.after.detectedPremiumColumnName,
      },
      dbMigrations,
      dbFingerprint,
    });
  } catch (error) {
    const safeMessage = safeTrim((error as any)?.message || error);
    console.error(`ROOT_CAUSE: dev-migrate DEV_MIGRATE_INTERNAL ${safeMessage}`);
    return jsonError(500, "DEV_MIGRATE_INTERNAL", "Migration runner failed", {
      dbFingerprint,
      warnings,
      migrationErrorSummary,
    });
  }
}
