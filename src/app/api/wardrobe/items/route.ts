import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

function normalizeToken(raw: string) {
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}

function getUserId(req: NextRequest): string | null {
  // Try Authorization header
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader) {
    const userId = verifyToken(normalizeToken(authHeader));
    if (userId) return userId;
  }

  // Try cookie
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (cookie) {
    const userId = verifyToken(normalizeToken(cookie.value));
    if (userId) return userId;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select()
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId))
    .orderBy(desc(wardrobe_items.createdAt));

  return NextResponse.json(items, { status: 200 });
}
