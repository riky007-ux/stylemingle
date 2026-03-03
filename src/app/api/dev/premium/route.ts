import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type PremiumPayload = {
  email: string;
  enabled?: boolean;
  token?: string;
};

type PremiumColumnName = "isPremium" | "is_premium" | null;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function safeTrim(value: unknown, max = 180) {
  return String(value || "").replace(/\s+/g, " ").slice(0, max);
}

function isProdLocked() {
  return process.env.VERCEL_ENV === "production" && process.env.ALLOW_DEV_PREMIUM_ENDPOINT !== "true";
}

function logRootCause(code: string, message: string) {
  console.warn(`ROOT_CAUSE: dev-premium ${code} ${safeTrim(message)}`);
}

function normalizeEmail(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return email.includes("@") && email.length >= 5;
}

async function parsePayload(req: Request): Promise<PremiumPayload | null> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await req.json().catch(() => null)) as PremiumPayload | null;
  }

  const form = await req.formData().catch(() => null);
  if (!form) return null;

  const enabledRaw = form.get("enabled");
  const enabledString = typeof enabledRaw === "string" ? enabledRaw.toLowerCase() : "";

  return {
    email: String(form.get("email") || ""),
    enabled: enabledString === "true" ? true : enabledString === "false" ? false : undefined,
    token: String(form.get("token") || ""),
  };
}

async function detectPremiumColumnName(): Promise<PremiumColumnName> {
  const result = await db.$client.execute("PRAGMA table_info(users);");
  const columns = (result.rows || []).map((row: any) => String(row?.name || ""));
  if (columns.includes("isPremium")) return "isPremium";
  if (columns.includes("is_premium")) return "is_premium";
  return null;
}

async function validateAuthAndToken(req: Request, payload?: PremiumPayload | null) {
  if (isProdLocked()) return { error: jsonError(404, "NOT_FOUND", "Endpoint disabled in production") };

  const actorUserId = getUserIdFromRequest(req);
  if (!actorUserId) return { error: jsonError(401, "NOT_AUTHENTICATED", "You must be logged in") };

  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  if (!expectedToken) return { error: jsonError(503, "ADMIN_TOKEN_NOT_CONFIGURED", "Admin token not configured") };

  const providedToken = req.headers.get("x-stylemingle-admin-token") || payload?.token || "";
  if (providedToken !== expectedToken) {
    return { error: jsonError(403, "INVALID_ADMIN_TOKEN", "Admin token is invalid") };
  }

  return { actorUserId };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = normalizeEmail(url.searchParams.get("email"));

  const auth = await validateAuthAndToken(req, null);
  if ("error" in auth) return auth.error;

  if (!isValidEmail(email)) {
    return jsonError(400, "INVALID_INPUT", "A valid email query parameter is required");
  }

  try {
    const premiumColumn = await detectPremiumColumnName();
    if (!premiumColumn) {
      const msg = "Missing users.isPremium column. Run /dashboard/dev/migrate (or apply migration 0003).";
      logRootCause("PREMIUM_SCHEMA_PENDING", "users premium column missing");
      return jsonError(503, "PREMIUM_SCHEMA_PENDING", msg);
    }

    const found = await db.$client.execute({
      sql: `SELECT id, email, ${premiumColumn} AS premiumValue FROM users WHERE email = ? LIMIT 1`,
      args: [email],
    });

    if (!(found.rows || [])[0]) {
      return jsonError(404, "USER_NOT_FOUND", "User not found");
    }

    const row: any = found.rows[0];
    return NextResponse.json({ ok: true, email: row.email, isPremium: Boolean(row.premiumValue) });
  } catch (error) {
    const safeMessage = "Unexpected database error while reading premium status";
    logRootCause("DEV_PREMIUM_INTERNAL", `${safeMessage}: ${safeTrim((error as any)?.message || error)}`);
    return jsonError(500, "DEV_PREMIUM_INTERNAL", safeMessage);
  }
}

export async function POST(req: Request) {
  const payload = await parsePayload(req);
  const auth = await validateAuthAndToken(req, payload);
  if ("error" in auth) return auth.error;

  const email = normalizeEmail(payload?.email);
  const enabled = payload?.enabled;

  if (!isValidEmail(email) || typeof enabled !== "boolean") {
    return jsonError(400, "INVALID_INPUT", "email and enabled(boolean) are required");
  }

  try {
    const premiumColumn = await detectPremiumColumnName();
    if (!premiumColumn) {
      const msg = "Missing users.isPremium column. Run /dashboard/dev/migrate (or apply migration 0003).";
      logRootCause("PREMIUM_SCHEMA_PENDING", "users premium column missing");
      return jsonError(503, "PREMIUM_SCHEMA_PENDING", msg);
    }

    const target = await db.$client.execute({
      sql: "SELECT id, email FROM users WHERE email = ? LIMIT 1",
      args: [email],
    });

    const targetRow: any = (target.rows || [])[0];
    if (!targetRow?.id) {
      return jsonError(404, "USER_NOT_FOUND", "User not found");
    }

    await db.$client.execute({
      sql: `UPDATE users SET ${premiumColumn} = ? WHERE id = ?`,
      args: [enabled ? 1 : 0, targetRow.id],
    });

    return NextResponse.json({ ok: true, email, enabled });
  } catch (error) {
    const safeMessage = "Unexpected database error while updating premium status";
    logRootCause("DEV_PREMIUM_INTERNAL", `${safeMessage}: ${safeTrim((error as any)?.message || error)}`);
    return jsonError(500, "DEV_PREMIUM_INTERNAL", safeMessage);
  }
}
