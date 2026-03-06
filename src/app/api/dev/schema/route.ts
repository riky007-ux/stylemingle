import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type PremiumColumnName = "isPremium" | "is_premium" | null;

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

function checkAuthAndToken(req: Request) {
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

async function readTables() {
  const tableRes = await db.$client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC");
  return (tableRes.rows || []).map((row: any) => String(row?.name || "")).filter(Boolean);
}

async function getTableColumns(table: string) {
  const result = await db.$client.execute(`PRAGMA table_info(${table});`);
  return (result.rows || []).map((row: any) => String(row?.name || "")).filter(Boolean);
}

async function inspectGate12State(): Promise<Gate12State> {
  const tables = await readTables();
  const usersColumns = tables.includes("users") ? await getTableColumns("users").catch(() => [] as string[]) : [];
  const styleColumns = tables.includes("user_style_profile") ? await getTableColumns("user_style_profile").catch(() => [] as string[]) : [];
  const ratingColumns = tables.includes("ratings") ? await getTableColumns("ratings").catch(() => [] as string[]) : [];

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

async function readDrizzleMigrations() {
  const tables = await readTables();
  const tableName = tables.find((n) => n === "__drizzle_migrations") || tables.find((n) => n.includes("drizzle") && n.includes("migration"));
  if (!tableName) return [] as string[];

  const rows = await db.$client.execute(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 20`);
  return (rows.rows || []).map((row: any) => String(row.hash ?? row.checksum ?? row.name ?? row.id ?? row.rowid ?? "unknown")).filter(Boolean);
}

export async function GET(req: Request) {
  const auth = checkAuthAndToken(req);
  if ("error" in auth) return auth.error;

  const dbFingerprint = makeDbFingerprint();
  const build = buildInfo();

  try {
    const before = await inspectGate12State();
    const after = before;
    const ready = gateReady(after);
    const reasons = blockingReasons(after);
    const dbMigrations = await readDrizzleMigrations();

    return jsonWithStatus(200, {
      ok: true,
      gate12Ready: ready,
      blockingReasons: reasons,
      warnings: [],
      migrationErrorSummary: null,
      forcedPremiumSchemaPatchApplied: false,
      forcedStyleProfileSchemaPatchApplied: false,
      forcedFeedbackSchemaPatchApplied: false,
      before,
      after,
      dbMigrations,
      dbFingerprint,
      buildInfo: build,
    });
  } catch {
    console.error("ROOT_CAUSE: dev-schema DEV_SCHEMA_INTERNAL failed to inspect gate12 state");
    return jsonWithStatus(500, {
      ok: false,
      gate12Ready: false,
      blockingReasons: ["DEV_SCHEMA_INTERNAL"],
      warnings: [],
      migrationErrorSummary: "Failed to inspect schema",
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
}
