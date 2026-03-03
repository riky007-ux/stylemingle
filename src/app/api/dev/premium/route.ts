import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expectedToken = process.env.PREMIUM_ADMIN_TOKEN;
  const providedToken = request.headers.get("x-stylemingle-admin-token");
  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }

  await db.update(users).set({ isPremium: body.enabled }).where(eq(users.id, userId));

  return NextResponse.json({ ok: true, isPremium: body.enabled });
}
