import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "fs";
import path from "path";

import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type PremiumColumnName = "isPremium" | "is_premium" | null;

function jsonError(status: number, code: string, message: string, extras: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extras }, { status });
}

function endpointEnabled() {
  return process.env.VERCEL_ENV !== "production" || process.env.ALLOW_DEV_MIGRATE_ENDPOINT === "true";
}

function safeTrim(value: unknown, max = 180) {
  return String(value || "").replace(/\s+/g, " ").slice(0, max);
}

function isAuthOrTokenInvalid(req: Request) {
  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  if (!expectedToken) {
    return { error: jsonError(503, "ADMIN_TOKEN_NOT_CONFIGURED", "Admin token not configured") };
  }

  const providedToken = req.headers.get("x-stylemingle-admin-token");
  if (!providedToken || providedToken !== expectedToken) {
    return { error: jsonError(403, "INVALID_ADMIN_TOKEN", "Admin token is invalid") };
  }

  return { ok: true };
}

function listMigrationFiles(migrationsFolder: string) {
  const all = fs.existsSync(migrationsFolder) ? fs.readdirSync(migrationsFolder) : [];
  const sqlFiles = all.filter((name) => /^\d+.*\.sql$/i.test(name)).sort();
  return { allFiles: all, sqlFiles };
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

async function readDrizzleMigrations(client: ReturnType<typeof createClient>) {
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const names = (tables.rows || []).map((row: any) => String(row?.name || ""));
  const tableName = names.find((n) => n === "__drizzle_migrations") || names.find((n) => n.includes("drizzle") && n.includes("migration"));
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
  if (!url || !authToken) {
    return jsonError(503, "DB_NOT_CONFIGURED", "Database environment variables are not configured");
  }

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    const message = `Missing migrations journal at ${journalPath}. Add drizzle/** to Next output tracing.`;
    console.error(`ROOT_CAUSE: dev-migrate MIGRATIONS_ASSET_MISSING ${safeTrim(message)}`);
    return jsonError(500, "MIGRATIONS_ASSET_MISSING", message);
  }

  const { allFiles, sqlFiles } = listMigrationFiles(migrationsFolder);
  if (sqlFiles.length === 0) {
    return jsonError(500, "MIGRATIONS_NOT_FOUND", `No migration SQL files found under ${migrationsFolder}`, {
      migrationsFolder,
      filesSeen: allFiles,
    });
  }

  const client = createClient({ url, authToken });
  const drizzleDb = drizzle(client);

  const beforeTablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const beforeTables = new Set((beforeTablesResult.rows || []).map((r: any) => String(r?.name || "")));

  try {
    await migrate(drizzleDb, { migrationsFolder });

    const afterTablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const afterTables = new Set((afterTablesResult.rows || []).map((r: any) => String(r?.name || "")));
    const applied = [...afterTables].filter((name) => name && !beforeTables.has(name));

    const afterSchema = await detectUsersPremiumSchema(client);
    const dbMigrations = await readDrizzleMigrations(client);
    const alreadyUpToDate = applied.length === 0;

    if (alreadyUpToDate && !afterSchema.hasIsPremium) {
      const message =
        "Migrations reported up-to-date but users premium column is still missing. Check drizzle asset bundling/tracing and __drizzle_migrations records.";
      console.error(`ROOT_CAUSE: dev-migrate MIGRATIONS_DID_NOT_PRODUCE_SCHEMA ${safeTrim(message)}`);
      return jsonError(500, "MIGRATIONS_DID_NOT_PRODUCE_SCHEMA", message, {
        migrationFilesFound: sqlFiles.length,
        latestMigrationName: sqlFiles[sqlFiles.length - 1] || null,
        after: {
          hasIsPremium: afterSchema.hasIsPremium,
          detectedPremiumColumnName: afterSchema.detectedPremiumColumnName,
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
      after: {
        hasIsPremium: afterSchema.hasIsPremium,
        detectedPremiumColumnName: afterSchema.detectedPremiumColumnName,
      },
      dbMigrations,
    });
  } catch (error) {
    const safeMessage = safeTrim((error as any)?.message || error);
    if (safeMessage.toLowerCase().includes("already exists")) {
      const afterSchema = await detectUsersPremiumSchema(client).catch(() => ({ hasIsPremium: false, detectedPremiumColumnName: null }));
      return NextResponse.json({
        ok: true,
        applied: [],
        alreadyUpToDate: true,
        migrationFilesFound: sqlFiles.length,
        latestMigrationName: sqlFiles[sqlFiles.length - 1] || null,
        after: {
          hasIsPremium: afterSchema.hasIsPremium,
          detectedPremiumColumnName: afterSchema.detectedPremiumColumnName,
        },
      });
    }

    console.error(`ROOT_CAUSE: dev-migrate DEV_MIGRATE_INTERNAL ${safeMessage}`);
    return jsonError(500, "DEV_MIGRATE_INTERNAL", "Migration runner failed");
  }
}
