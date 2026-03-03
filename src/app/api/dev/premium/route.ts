import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

export const runtime = "nodejs";

type PremiumPayload = {
  email: string;
  enabled?: boolean;
  token?: string;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function isProdLocked() {
  return process.env.VERCEL_ENV === "production" && process.env.ALLOW_DEV_PREMIUM_ENDPOINT !== "true";
}

function isPremiumSchemaPending(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  const schemaHint = msg.includes("no such column") || msg.includes("unknown column") || msg.includes("does not exist") || msg.includes("sqlite_error");
  const premiumHint = msg.includes("ispremium") || msg.includes("is premium");
  return schemaHint && premiumHint;
}

function logRootCause(code: string, message: string) {
  console.warn(`ROOT_CAUSE: dev-premium ${code} ${message}`);
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
    const found = await db
      .select({ email: users.email, isPremium: users.isPremium })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!found[0]) {
      return jsonError(404, "USER_NOT_FOUND", "User not found");
    }

    return NextResponse.json({ ok: true, email: found[0].email, isPremium: Boolean(found[0].isPremium) });
  } catch (error) {
    if (isPremiumSchemaPending(error)) {
      const safeMessage = "Premium column migration is pending";
      logRootCause("PREMIUM_SCHEMA_PENDING", safeMessage);
      return jsonError(503, "PREMIUM_SCHEMA_PENDING", safeMessage);
    }

    const safeMessage = "Unexpected database error while reading premium status";
    logRootCause("DEV_PREMIUM_INTERNAL", safeMessage);
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
    const target = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
    if (!target[0]?.id) {
      return jsonError(404, "USER_NOT_FOUND", "User not found");
    }

    await db
      .update(users)
      .set({ isPremium: enabled })
      .where(and(eq(users.id, target[0].id), eq(users.email, email)));

    return NextResponse.json({ ok: true, email, enabled });
  } catch (error) {
    if (isPremiumSchemaPending(error)) {
      const safeMessage = "Premium column migration is pending";
      logRootCause("PREMIUM_SCHEMA_PENDING", safeMessage);
      return jsonError(503, "PREMIUM_SCHEMA_PENDING", safeMessage);
    }

    const safeMessage = "Unexpected database error while updating premium status";
    logRootCause("DEV_PREMIUM_INTERNAL", safeMessage);
    return jsonError(500, "DEV_PREMIUM_INTERNAL", safeMessage);
  }
}
