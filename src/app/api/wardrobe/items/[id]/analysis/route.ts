import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";
import {
  isVisualAwarenessEnabled,
  parseJsonArray,
  parseJsonMap,
  VISUAL_REVIEW_FIELDS,
  type VisualReviewField,
} from "@/lib/visualAwareness";

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

function asStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
}

function asReviewFields(value: unknown): VisualReviewField[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((field): field is string => typeof field === "string")
    .filter((field): field is VisualReviewField => VISUAL_REVIEW_FIELDS.includes(field as VisualReviewField));
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

  const now = new Date();

  const category = asStringOrNull((body as any).category);
  const subcategory = asStringOrNull((body as any).subcategory);
  const primaryColor = asStringOrNull((body as any).primaryColor);
  const secondaryColors = asStringArray((body as any).secondaryColors);
  const pattern = asStringOrNull((body as any).pattern);
  const material = asStringOrNull((body as any).material);
  const seasonality = asStringArray((body as any).seasonality);
  const styleTags = asStringArray((body as any).styleTags);
  const brandCandidate = asStringOrNull((body as any).brandCandidate);
  const sizeEstimateCandidate = asStringOrNull((body as any).sizeEstimateCandidate);
  const needsReviewFields = asReviewFields((body as any).needsReviewFields);

  const status = needsReviewFields.length === 0 ? "complete" : "needs_review";

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
        status,
        category,
        subcategory,
        primaryColor,
        secondaryColors: JSON.stringify(secondaryColors),
        pattern,
        material,
        seasonality: JSON.stringify(seasonality),
        styleTags: JSON.stringify(styleTags),
        brandCandidate,
        sizeEstimateCandidate,
        needsReviewFields: JSON.stringify(needsReviewFields),
        reviewedAt: now,
        updatedAt: now,
        createdAt: now,
        fieldConfidence: "{}",
        overallConfidence: 0,
      })
      .returning();
    updated = created;
  } else {
    const [saved] = await db
      .update(wardrobe_item_analysis)
      .set({
        status,
        category,
        subcategory,
        primaryColor,
        secondaryColors: JSON.stringify(secondaryColors),
        pattern,
        material,
        seasonality: JSON.stringify(seasonality),
        styleTags: JSON.stringify(styleTags),
        brandCandidate,
        sizeEstimateCandidate,
        needsReviewFields: JSON.stringify(needsReviewFields),
        reviewedAt: now,
        updatedAt: now,
      })
      .where(and(eq(wardrobe_item_analysis.itemId, params.id), eq(wardrobe_item_analysis.userId, userId)))
      .returning();
    updated = saved;
  }

  await db
    .update(wardrobe_items)
    .set({
      category,
      primaryColor,
      styleTag: styleTags[0] ?? null,
    })
    .where(and(eq(wardrobe_items.id, params.id), eq(wardrobe_items.userId, userId)));

  return NextResponse.json({ analysis: serializeAnalysis(updated) });
}
