import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";

/**
 * GET /api/wardrobe/items
 * Return ONLY columns that are confirmed to exist in the actual Turso table.
 * (The DB does NOT have wardrobe metadata columns like category/color/style/etc.)
 */
export async function GET() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: wardrobe_items.id,
      userId: wardrobe_items.userId,
      imageUrl: wardrobe_items.imageUrl,
      createdAt: wardrobe_items.createdAt,
    })
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId))
    .orderBy(desc(wardrobe_items.createdAt));

  return NextResponse.json(rows);
}

/**
 * POST /api/wardrobe/items
 * Persist a wardrobe item using a Blob image URL.
 * Insert ONLY the columns that exist in the actual table.
 */
export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Drizzle schema types this as Date (timestamp mode)
  const createdAt = new Date();

  try {
    await db.insert(wardrobe_items).values({
      id,
      userId,
      imageUrl,
      createdAt,
    });

    return NextResponse.json(
      { id, userId, imageUrl, createdAt },
      { status: 201 }
    );
  } catch (err) {
    console.error("WARDROBE_ITEMS_INSERT_FAILED", err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/wardrobe/items
 * Deletes a wardrobe item owned by the authenticated user.
 */
export async function DELETE(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let id = url.searchParams.get("id");

  if (!id) {
    try {
      const body: any = await request.json();
      id = body?.id;
    } catch {
      // no body provided
    }
  }

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await db
      .delete(wardrobe_items)
      .where(and(eq(wardrobe_items.id, id), eq(wardrobe_items.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("WARDROBE_ITEMS_DELETE_FAILED", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
