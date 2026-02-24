import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { avatar_preferences } from "@/lib/schema";
import { DEFAULT_AVATAR_PREFERENCES } from "@/lib/avatar/types";

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function isMissingTableOrColumn(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return msg.includes("no such table") || msg.includes("no such column") || msg.includes("has no column named");
}

function migrationRequiredResponse() {
  return NextResponse.json(
    { error: "Database migration required", code: "DB_MIGRATION_REQUIRED" },
    { status: 503 }
  );
}

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [existing] = await db.select().from(avatar_preferences).where(eq(avatar_preferences.userId, userId)).limit(1);

    if (existing) return NextResponse.json(existing);
    return NextResponse.json({ ...DEFAULT_AVATAR_PREFERENCES, userId, id: null });
  } catch (error) {
    if (isMissingTableOrColumn(error)) return migrationRequiredResponse();
    return NextResponse.json({ error: "Failed to load avatar preferences" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const payload = {
    gender: body.gender,
    skinToneKey: body.skinToneKey,
    hairStyleKey: body.hairStyleKey,
    hairColorKey: body.hairColorKey,
    faceStyleKey: body.faceStyleKey,
    bodySize: body.bodySize,
  };

  try {
    const [existing] = await db.select().from(avatar_preferences).where(eq(avatar_preferences.userId, userId)).limit(1);

    if (existing) {
      const [updated] = await db
        .update(avatar_preferences)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(avatar_preferences.userId, userId))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(avatar_preferences)
      .values({ id: randomUUID(), userId, ...payload, updatedAt: new Date() })
      .returning();

    return NextResponse.json(created);
  } catch (error) {
    if (isMissingTableOrColumn(error)) return migrationRequiredResponse();
    return NextResponse.json({ error: "Failed to save avatar preferences" }, { status: 500 });
  }
}
