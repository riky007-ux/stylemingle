import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasEntitlement } from "@/lib/personalization/entitlements";
import { hasFeedbackColumns, isPersonalizationSchemaError, recordOutfitFeedbackLegacySafe } from "@/lib/personalization/profile";
import { outfits } from "@/lib/schema";

export async function POST(request: Request, { params }: { params: { outfitId: string } }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitled = await hasEntitlement(userId, "personalization_memory", request);
  if (!entitled) {
    return NextResponse.json({ error: "Personalization memory is a premium feature" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rating = body?.rating;
  if (typeof rating !== "number") {
    return NextResponse.json({ error: "rating must be a number" }, { status: 400 });
  }

  try {
    const feedbackSchemaReady = await hasFeedbackColumns();
    if (!feedbackSchemaReady) {
      console.warn("ROOT_CAUSE: feedback FEEDBACK_SCHEMA_PENDING ratings reasons/note columns missing");
      return NextResponse.json({ error: "Feedback temporarily unavailable while database migrates", code: "FEEDBACK_SCHEMA_PENDING" }, { status: 503 });
    }
  } catch (error) {
    if (isPersonalizationSchemaError(error)) {
      console.warn("ROOT_CAUSE: feedback FEEDBACK_SCHEMA_PENDING ratings schema lookup failed");
      return NextResponse.json({ error: "Feedback temporarily unavailable while database migrates", code: "FEEDBACK_SCHEMA_PENDING" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to validate feedback schema" }, { status: 500 });
  }

  const foundOutfit = await db
    .select({ id: outfits.id })
    .from(outfits)
    .where(and(eq(outfits.id, params.outfitId), eq(outfits.userId, userId)))
    .limit(1);

  if (!foundOutfit[0]) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }

  try {
    const result = await recordOutfitFeedbackLegacySafe(
      userId,
      params.outfitId,
      rating,
      Array.isArray(body?.reasons) ? body.reasons : [],
      body?.note,
    );
    return NextResponse.json({ ok: true, legacyFallback: Boolean((result as any)?.legacyFallback) });
  } catch (error) {
    if (isPersonalizationSchemaError(error)) {
      console.warn("ROOT_CAUSE: feedback FEEDBACK_SCHEMA_PENDING schema mismatch during insert");
      return NextResponse.json({ error: "Feedback temporarily unavailable while database migrates", code: "FEEDBACK_SCHEMA_PENDING" }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
