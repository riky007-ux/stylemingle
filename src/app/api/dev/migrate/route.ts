import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "fs";
import path from "path";

import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
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

  const client = createClient({ url, authToken });
  const drizzleDb = drizzle(client);

  const before = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const beforeTables = new Set((before.rows || []).map((r: any) => String(r?.name || "")));

  try {
    await migrate(drizzleDb, { migrationsFolder });

    const after = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const afterTables = new Set((after.rows || []).map((r: any) => String(r?.name || "")));
    const applied = [...afterTables].filter((name) => name && !beforeTables.has(name));

    return NextResponse.json({
      ok: true,
      applied,
      alreadyUpToDate: applied.length === 0,
    });
  } catch (error) {
    const safeMessage = safeTrim((error as any)?.message || error);
    if (safeMessage.toLowerCase().includes("already exists")) {
      return NextResponse.json({ ok: true, applied: [], alreadyUpToDate: true });
    }

    console.error(`ROOT_CAUSE: dev-migrate DEV_MIGRATE_INTERNAL ${safeMessage}`);
    return jsonError(500, "DEV_MIGRATE_INTERNAL", "Migration runner failed");
  }
}
