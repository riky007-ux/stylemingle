import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = verifyToken(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId))
    .orderBy(desc(wardrobe_items.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = verifyToken(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date();

  try {
    await db.insert(wardrobe_items).values({
      id,
      userId,
      imageUrl,
      createdAt,
    });

    return NextResponse.json({ id, userId, imageUrl, createdAt }, { status: 201 });
  } catch (err) {
    console.error("WARDROBE_ITEMS_INSERT_FAILED", err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
