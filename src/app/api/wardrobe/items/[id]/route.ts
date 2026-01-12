import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getUserIdFromAuthHeader } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getUserIdFromAuthHeader(req.headers);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const itemId = params.id;

  try {
    // Ensure the item exists and belongs to the user
    const item = await db
      .select({ id: wardrobe_items.id })
      .from(wardrobe_items)
      .where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)))
      .limit(1);

    if (!item || item.length === 0) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    // Delete the item
    await db
      .delete(wardrobe_items)
      .where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
