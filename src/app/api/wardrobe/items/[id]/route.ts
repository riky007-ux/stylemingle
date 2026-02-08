import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

/**
 * DELETE /api/wardrobe/items/:id
 * Must use the same cookie/JWT auth mechanism as GET/POST /api/wardrobe/items
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const itemId = params.id;

  try {
    const item = await db
      .select({ id: wardrobe_items.id })
      .from(wardrobe_items)
      .where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)))
      .limit(1);

    if (!item || item.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .delete(wardrobe_items)
      .where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)));

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("WARDROBE_ITEMS_DELETE_FAILED", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
