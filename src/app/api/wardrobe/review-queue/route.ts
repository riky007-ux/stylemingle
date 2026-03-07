import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";
import { isVisualAwarenessEnabled, parseJsonArray, parseJsonMap } from "@/lib/visualAwareness";

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  if (!isVisualAwarenessEnabled()) return NextResponse.json({ error: "VISUAL_AWARENESS_DISABLED" }, { status: 404 });
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      analysis: wardrobe_item_analysis,
      imageUrl: wardrobe_items.imageUrl,
    })
    .from(wardrobe_item_analysis)
    .innerJoin(wardrobe_items, eq(wardrobe_item_analysis.itemId, wardrobe_items.id))
    .where(and(eq(wardrobe_item_analysis.userId, userId), eq(wardrobe_item_analysis.status, "needs_review")))
    .orderBy(desc(wardrobe_item_analysis.updatedAt));

  return NextResponse.json({
    queue: rows.map(({ analysis, imageUrl }) => ({
      ...analysis,
      imageUrl,
      secondaryColors: parseJsonArray(analysis.secondaryColors),
      seasonality: parseJsonArray(analysis.seasonality),
      styleTags: parseJsonArray(analysis.styleTags),
      needsReviewFields: parseJsonArray(analysis.needsReviewFields),
      fieldConfidence: parseJsonMap(analysis.fieldConfidence),
    })),
  });
}
