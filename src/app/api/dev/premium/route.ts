import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

function isSchemaPendingError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("no such column") ||
    message.includes("has no column named") ||
    message.includes("no such table") ||
    message.includes("sqlite_error")
  );
}

function devPremiumEndpointEnabled() {
  return process.env.VERCEL_ENV !== "production" || process.env.ALLOW_DEV_PREMIUM_ENDPOINT === "true";
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed", allowedMethods: ["POST"] }, { status: 405 });
}

export async function POST(request: Request) {
  if (!devPremiumEndpointEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actorUserId = getUserIdFromRequest(request);
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  const providedToken = request.headers.get("x-stylemingle-admin-token");
  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }

  try {
    const target = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!target[0]?.id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db
      .update(users)
      .set({ isPremium: body.enabled })
      .where(and(eq(users.id, target[0].id), eq(users.email, email)));

    return NextResponse.json({ ok: true, email, enabled: body.enabled });
  } catch (error) {
    if (isSchemaPendingError(error)) {
      return NextResponse.json({ error: "Premium toggle temporarily unavailable while database migrates", code: "PREMIUM_SCHEMA_PENDING" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update premium state" }, { status: 500 });
  }
}
