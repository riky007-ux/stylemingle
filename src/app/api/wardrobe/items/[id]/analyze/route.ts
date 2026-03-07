import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";
import { isVisualAwarenessEnabled, isVisualAwarenessProofModeEnabled } from "@/lib/visualAwareness";
import { runWardrobeVisionAnalysis } from "@/lib/wardrobeVisionAnalysis";

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function disabledResponse() {
  return NextResponse.json({ error: "VISUAL_AWARENESS_DISABLED" }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isVisualAwarenessEnabled()) return disabledResponse();
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const wantsForceNeedsReview = Boolean((body as any)?.forceNeedsReview);
  const shouldForceNeedsReview = wantsForceNeedsReview && isVisualAwarenessProofModeEnabled();

  const [item] = await db
    .select()
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.id, params.id), eq(wardrobe_items.userId, userId)))
    .limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();

  const [existing] = await db
    .select()
    .from(wardrobe_item_analysis)
    .where(and(eq(wardrobe_item_analysis.itemId, params.id), eq(wardrobe_item_analysis.userId, userId)))
    .limit(1);

  if (!item.imageUrl) {
    const patch = {
      status: "failed" as const,
      failureCode: "MISSING_IMAGE_URL",
      failureMessage: "Wardrobe item has no image URL",
      updatedAt: now,
    };
    if (existing) {
      await db.update(wardrobe_item_analysis).set(patch).where(eq(wardrobe_item_analysis.id, existing.id));
    } else {
      await db.insert(wardrobe_item_analysis).values({
        id: randomUUID(),
        itemId: item.id,
        userId,
        status: "failed",
        createdAt: now,
        updatedAt: now,
        failureCode: "MISSING_IMAGE_URL",
        failureMessage: "Wardrobe item has no image URL",
      });
    }
    return NextResponse.json({ error: "MISSING_IMAGE_URL" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }

  if (existing) {
    await db
      .update(wardrobe_item_analysis)
      .set({ status: "pending", failureCode: null, failureMessage: null, updatedAt: now })
      .where(eq(wardrobe_item_analysis.id, existing.id));
  } else {
    await db.insert(wardrobe_item_analysis).values({
      id: randomUUID(),
      itemId: item.id,
      userId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    const { analysis, rawModelPayload } = await runWardrobeVisionAnalysis(item.imageUrl);

    const finalAnalysis = shouldForceNeedsReview
      ? {
          ...analysis,
          overallConfidence: Math.min(analysis.overallConfidence, 0.55),
          fieldConfidence: {
            ...analysis.fieldConfidence,
            brandCandidate: 0.2,
          },
          needsReviewFields: [...new Set([...(analysis.needsReviewFields || []), "brandCandidate"])],
        }
      : analysis;

    const status = finalAnalysis.needsReviewFields.length > 0 ? "needs_review" : "complete";

    const [saved] = await db
      .update(wardrobe_item_analysis)
      .set({
        status,
        category: finalAnalysis.category,
        subcategory: finalAnalysis.subcategory,
        primaryColor: finalAnalysis.primaryColor,
        secondaryColors: JSON.stringify(finalAnalysis.secondaryColors),
        pattern: finalAnalysis.pattern,
        material: finalAnalysis.material,
        seasonality: JSON.stringify(finalAnalysis.seasonality),
        styleTags: JSON.stringify(finalAnalysis.styleTags),
        brandCandidate: finalAnalysis.brandCandidate,
        sizeEstimateCandidate: finalAnalysis.sizeEstimateCandidate,
        fieldConfidence: JSON.stringify(finalAnalysis.fieldConfidence),
        overallConfidence: Math.round(finalAnalysis.overallConfidence * 100),
        needsReviewFields: JSON.stringify(finalAnalysis.needsReviewFields),
        rawModelPayload,
        analyzedAt: now,
        updatedAt: now,
      })
      .where(and(eq(wardrobe_item_analysis.itemId, item.id), eq(wardrobe_item_analysis.userId, userId)))
      .returning();

    if (!saved) {
      return NextResponse.json({ error: "DB_PERSISTENCE_FAILURE" }, { status: 500 });
    }

    await db
      .update(wardrobe_items)
      .set({
        category: finalAnalysis.category ?? item.category,
        primaryColor: finalAnalysis.primaryColor ?? item.primaryColor,
        styleTag: finalAnalysis.styleTags[0] ?? item.styleTag,
      })
      .where(and(eq(wardrobe_items.id, item.id), eq(wardrobe_items.userId, userId)));

    return NextResponse.json({
      status,
      analysis: saved,
      routeUsed: "/api/wardrobe/items/[id]/analyze",
      proofMode: shouldForceNeedsReview,
    });
  } catch (error) {
    const code = String((error as any)?.message || "MODEL_FAILURE").includes("INVALID_MODEL_RESPONSE")
      ? "INVALID_MODEL_RESPONSE"
      : "MODEL_FAILURE";

    await db
      .update(wardrobe_item_analysis)
      .set({
        status: "failed",
        failureCode: code,
        failureMessage: String((error as any)?.message || "analysis failed").slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(wardrobe_item_analysis.itemId, item.id), eq(wardrobe_item_analysis.userId, userId)));

    return NextResponse.json({ error: code }, { status: 500 });
  }
}
