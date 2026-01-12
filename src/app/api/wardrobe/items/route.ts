import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getUserIdFromAuthHeader } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 1️⃣ Authenticate
  const userId = getUserIdFromAuthHeader(req.headers);

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 2️⃣ Fetch wardrobe items safely
    const items = await db
      .select({
        id: wardrobe_items.id,
        imageUrl: wardrobe_items.imageUrl,
        createdAt: wardrobe_items.createdAt,
      })
      .from(wardrobe_items)
      .where(eq(wardrobe_items.userId, userId))
      .orderBy(desc(wardrobe_items.createdAt));

    // 3️⃣ ALWAYS return an array (even if empty)
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/wardrobe/items failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
