import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type PremiumColumnName = "isPremium" | "is_premium" | null;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function endpointEnabled() {
  return process.env.VERCEL_ENV !== "production" || process.env.ALLOW_DEV_MIGRATE_ENDPOINT === "true";
}

function normalizeTableName(value: string | null) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return "";
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) return "";
  return cleaned;
}

function detectPremiumColumnName(columns: string[]): PremiumColumnName {
  if (columns.includes("isPremium")) return "isPremium";
  if (columns.includes("is_premium")) return "is_premium";
  return null;
}

async function readDrizzleMigrations() {
  const tables = await db.$client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const names = (tables.rows || []).map((row: any) => String(row?.name || ""));
  const tableName = names.find((n) => n === "__drizzle_migrations") || names.find((n) => n.includes("drizzle") && n.includes("migration"));
  if (!tableName) return [];

  const rows = await db.$client.execute(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 20`);
  return (rows.rows || []).map((row: any) => ({
    id: row.id ?? row.rowid ?? null,
    hash: row.hash ?? row.checksum ?? row.name ?? null,
    createdAt: row.created_at ?? row.createdAt ?? row.created ?? null,
  }));
}

function checkAuthAndToken(req: Request) {
  if (!endpointEnabled()) return { error: jsonError(404, "NOT_FOUND", "Endpoint disabled in production") };

  const userId = getUserIdFromRequest(req);
  if (!userId) return { error: jsonError(401, "NOT_AUTHENTICATED", "You must be logged in") };

  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  if (!expectedToken) return { error: jsonError(503, "ADMIN_TOKEN_NOT_CONFIGURED", "Admin token not configured") };

  const providedToken = req.headers.get("x-stylemingle-admin-token") || "";
  if (providedToken !== expectedToken) return { error: jsonError(403, "INVALID_ADMIN_TOKEN", "Admin token is invalid") };

  return { userId };
}

export async function GET(req: Request) {
  const auth = checkAuthAndToken(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const mode = String(url.searchParams.get("mode") || "").trim();

  try {
    if (mode === "list-tables") {
      const tables = await db.$client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC");
      return NextResponse.json({
        ok: true,
        mode: "list-tables",
        tables: (tables.rows || []).map((row: any) => String(row?.name || "")).filter(Boolean),
      });
    }

    const table = normalizeTableName(url.searchParams.get("table"));
    if (!table) {
      return jsonError(400, "INVALID_INPUT", "table query parameter is required (or mode=list-tables)");
    }

    const pragma = await db.$client.execute(`PRAGMA table_info(${table});`);
    const columns = (pragma.rows || []).map((row: any) => String(row?.name || ""));
    const detectedPremiumColumnName = table === "users" ? detectPremiumColumnName(columns) : null;
    const dbMigrations = await readDrizzleMigrations();

    return NextResponse.json({
      ok: true,
      table,
      columns,
      hasIsPremium: table === "users" ? Boolean(detectedPremiumColumnName) : false,
      detectedPremiumColumnName,
      dbMigrations,
    });
  } catch {
    return jsonError(500, "DEV_SCHEMA_INTERNAL", "Failed to inspect schema");
  }
}
