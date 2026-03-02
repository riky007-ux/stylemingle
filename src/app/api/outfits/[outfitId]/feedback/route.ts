import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { hasEntitlement, hasProofTokenBypass } from "@/lib/personalization/entitlements";
import { recordOutfitFeedback } from "@/lib/personalization/profile";

export async function POST(request: Request, { params }: { params: { outfitId: string } }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitled = (await hasEntitlement(userId, "personalization_memory")) || hasProofTokenBypass(request);
  if (!entitled) {
    return NextResponse.json({ error: "Personalization memory is a premium feature" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rating = body?.rating;
  if (typeof rating !== "number") {
    return NextResponse.json({ error: "rating must be a number" }, { status: 400 });
  }

  await recordOutfitFeedback(userId, params.outfitId, rating, Array.isArray(body?.reasons) ? body.reasons : [], body?.note);
  return NextResponse.json({ ok: true });
}
