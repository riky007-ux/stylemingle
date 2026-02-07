import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { getUserIdFromRequest } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getUserIdFromRequest(req);
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

    // Successful delete — no body needed
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/wardrobe/items/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
