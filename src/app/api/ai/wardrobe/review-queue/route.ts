import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";

export async function GET() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const userId = token ? verifyToken(token) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      analysisId: wardrobe_item_analysis.id,
      wardrobeItemId: wardrobe_item_analysis.wardrobeItemId,
      status: wardrobe_item_analysis.status,
      routeUsed: wardrobe_item_analysis.routeUsed,
      proofMode: wardrobe_item_analysis.proofMode,
      needsReviewFields: wardrobe_item_analysis.needsReviewFields,
      imageUrl: wardrobe_items.imageUrl,
      category: wardrobe_items.category,
      primaryColor: wardrobe_items.primaryColor,
      styleTag: wardrobe_items.styleTag,
    })
    .from(wardrobe_item_analysis)
    .innerJoin(wardrobe_items, eq(wardrobe_items.id, wardrobe_item_analysis.wardrobeItemId))
    .where(and(eq(wardrobe_item_analysis.userId, userId), eq(wardrobe_item_analysis.status, "needs_review")))
    .catch(() => []);

  return NextResponse.json({
    queue: rows.map((row) => ({
      ...row,
      needsReviewFields: JSON.parse(row.needsReviewFields || "[]"),
    })),
  });
}
