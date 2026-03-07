import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";

export async function GET(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const userId = token ? verifyToken(token) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

  const [analysis] = await db
    .select()
    .from(wardrobe_item_analysis)
    .where(and(eq(wardrobe_item_analysis.userId, userId), eq(wardrobe_item_analysis.wardrobeItemId, itemId)))
    .limit(1)
    .catch(() => []);

  if (!analysis) {
    return NextResponse.json({
      wardrobeItemId: itemId,
      status: "not_analyzed",
      routeUsed: null,
      proofMode: false,
      needsReviewFields: [],
    });
  }

  const [item] = await db
    .select({ id: wardrobe_items.id, category: wardrobe_items.category, primaryColor: wardrobe_items.primaryColor, styleTag: wardrobe_items.styleTag })
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)))
    .limit(1);

  return NextResponse.json({
    ...analysis,
    needsReviewFields: JSON.parse(analysis.needsReviewFields || "[]"),
    item: item || null,
  });
}
