import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { runVisionTagging } from "../tagging";
import { wardrobe_item_analysis, wardrobe_items } from "@/lib/schema";

function canUseProofMode() {
  return process.env.VERCEL_ENV !== "production";
}

function envFlag(name: string) {
  const value = process.env[name] || "";
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const userId = token ? verifyToken(token) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { itemId?: string; forceNeedsReview?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

  const [item] = await db
    .select()
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.id, body.itemId), eq(wardrobe_items.userId, userId)))
    .limit(1);

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [tagged] = await runVisionTagging([{ itemId: item.id, imageUrl: item.imageUrl }]);

  const proofModeEnabled = envFlag("GATE13_PROOF_MODE") && canUseProofMode();
  const forceNeedsReview = proofModeEnabled && body.forceNeedsReview === true;
  const needsReviewFields = forceNeedsReview ? ["category", "primaryColor"] : [];

  const [updatedItem] = await db
    .update(wardrobe_items)
    .set({
      category: tagged.category,
      primaryColor: tagged.primaryColor,
      styleTag: tagged.styleTag,
    })
    .where(and(eq(wardrobe_items.id, item.id), eq(wardrobe_items.userId, userId)))
    .returning();

  const now = new Date();
  const existing = await db
    .select({ id: wardrobe_item_analysis.id })
    .from(wardrobe_item_analysis)
    .where(and(eq(wardrobe_item_analysis.wardrobeItemId, item.id), eq(wardrobe_item_analysis.userId, userId)))
    .limit(1)
    .catch(() => []);

  const analysisPayload = {
    status: forceNeedsReview ? "needs_review" as const : "complete" as const,
    routeUsed: "gate13_analyze",
    proofMode: proofModeEnabled,
    needsReviewFields: JSON.stringify(needsReviewFields),
    category: tagged.category,
    primaryColor: tagged.primaryColor,
    styleTag: tagged.styleTag,
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db
      .update(wardrobe_item_analysis)
      .set(analysisPayload)
      .where(eq(wardrobe_item_analysis.id, existing[0].id));
  } else {
    await db.insert(wardrobe_item_analysis).values({
      id: randomUUID(),
      wardrobeItemId: item.id,
      userId,
      ...analysisPayload,
      createdAt: now,
    });
  }

  return NextResponse.json({
    ...updatedItem,
    analysisStatus: analysisPayload.status,
    routeUsed: analysisPayload.routeUsed,
    proofMode: analysisPayload.proofMode,
    needsReviewFields,
  });
}
