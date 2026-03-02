import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { hasEntitlement, hasProofTokenBypass } from "@/lib/personalization/entitlements";
import { getStyleProfile, upsertStyleProfile } from "@/lib/personalization/profile";

async function assertAccess(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const entitled = (await hasEntitlement(userId, "personalization_memory")) || hasProofTokenBypass(request);
  if (!entitled) return { error: NextResponse.json({ error: "Personalization memory is a premium feature" }, { status: 403 }) };

  return { userId };
}

export async function GET(request: Request) {
  const access = await assertAccess(request);
  if ("error" in access) return access.error;

  const profile = await getStyleProfile(access.userId);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const access = await assertAccess(request);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const profile = await upsertStyleProfile(access.userId, body);
  return NextResponse.json({ profile });
}
