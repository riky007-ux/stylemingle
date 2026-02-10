import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { desc, eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

/**
 * Derives a public, cacheable thumbnail URL from a Vercel Blob image URL.
 * Uses Vercel Blob image transforms (edge-optimized).
 */
function getThumbnailUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    url.searchParams.set("w", "400");
    url.searchParams.set("h", "400");
    url.searchParams.set("fit", "cover");
    url.searchParams.set("q", "75");
    return url.toString();
  } catch {
    return imageUrl;
  }
}

/**
 * GET /api/wardrobe/items
 *
 * Returns all wardrobe items for the authenticated user.
 * Adds a derived `thumbnailUrl` for safe, cross-browser rendering.
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

  const response = rows.map((item) => ({
    ...item,
    thumbnailUrl: getThumbnailUrl(item.imageUrl),
  }));

  return NextResponse.json(response);
}

/**
 * DELETE /api/wardrobe/items
 *
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

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db
    .delete(wardrobe_items)
    .where(
      and(
        eq(wardrobe_items.id, id),
        eq(wardrobe_items.userId, userId)
      )
    );

  return NextResponse.json({ success: true });
}
