import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";
import { isVisualAwarenessEnabled, parseJsonArray, parseJsonMap, VISUAL_REVIEW_FIELDS } from "@/lib/visualAwareness";

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function disabledResponse() {
  return NextResponse.json({ error: "VISUAL_AWARENESS_DISABLED" }, { status: 404 });
}

function serializeAnalysis(row: any) {
  if (!row) return null;
  return {
    ...row,
    secondaryColors: parseJsonArray(row.secondaryColors),
    seasonality: parseJsonArray(row.seasonality),
    styleTags: parseJsonArray(row.styleTags),
    needsReviewFields: parseJsonArray(row.needsReviewFields),
    fieldConfidence: parseJsonMap(row.fieldConfidence),
  };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isVisualAwarenessEnabled()) return disabledResponse();
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [analysis] = await db
    .select()
    .from(wardrobe_item_analysis)
    .where(and(eq(wardrobe_item_analysis.itemId, params.id), eq(wardrobe_item_analysis.userId, userId)))
    .limit(1);

  if (!analysis) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ analysis: serializeAnalysis(analysis) });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isVisualAwarenessEnabled()) return disabledResponse();
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [item] = await db
    .select({ id: wardrobe_items.id })
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.id, params.id), eq(wardrobe_items.userId, userId)))
    .limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: any = {
    category: body.category ?? null,
    subcategory: body.subcategory ?? null,
    primaryColor: body.primaryColor ?? null,
    secondaryColors: JSON.stringify(Array.isArray(body.secondaryColors) ? body.secondaryColors : []),
    pattern: body.pattern ?? null,
    material: body.material ?? null,
    seasonality: JSON.stringify(Array.isArray(body.seasonality) ? body.seasonality : []),
    styleTags: JSON.stringify(Array.isArray(body.styleTags) ? body.styleTags : []),
    brandCandidate: body.brandCandidate ?? null,
    sizeEstimateCandidate: body.sizeEstimateCandidate ?? null,
    needsReviewFields: JSON.stringify(Array.isArray(body.needsReviewFields) ? body.needsReviewFields.filter((f: string) => VISUAL_REVIEW_FIELDS.includes(f as any)) : []),
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(wardrobe_item_analysis)
    .where(and(eq(wardrobe_item_analysis.itemId, params.id), eq(wardrobe_item_analysis.userId, userId)))
    .limit(1);

  let updated;
  if (!existing) {
    const [created] = await db
      .insert(wardrobe_item_analysis)
      .values({
        id: randomUUID(),
        itemId: params.id,
        userId,
        status: patch.needsReviewFields === "[]" ? "complete" : "needs_review",
        ...patch,
        fieldConfidence: "{}",
        overallConfidence: 0,
        createdAt: new Date(),
      })
      .returning();
    updated = created;
  } else {
    const [saved] = await db
      .update(wardrobe_item_analysis)
      .set({
        ...patch,
        status: patch.needsReviewFields === "[]" ? "complete" : "needs_review",
      })
      .where(and(eq(wardrobe_item_analysis.itemId, params.id), eq(wardrobe_item_analysis.userId, userId)))
      .returning();
    updated = saved;
  }

  await db
    .update(wardrobe_items)
    .set({
      category: patch.category,
      primaryColor: patch.primaryColor,
      styleTag: (JSON.parse(patch.styleTags)[0] as string) ?? null,
    })
    .where(and(eq(wardrobe_items.id, params.id), eq(wardrobe_items.userId, userId)));

  return NextResponse.json({ analysis: serializeAnalysis(updated) });
}
