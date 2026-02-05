import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { randomUUID } from "crypto";

function normalizeToken(raw: string) {
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}

function getUserId(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader) {
    const userId = verifyToken(normalizeToken(authHeader));
    if (userId) return userId;
  }
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

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { imageUrl } = body ?? {};
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "Invalid imageUrl" }, { status: 400 });
  }
  const newItem = {
    id: randomUUID(),
    userId,
    imageUrl,
    createdAt: new Date(),
  };
  await db.insert(wardrobe_items).values(newItem);
  return NextResponse.json(newItem, { status: 201 });
}
