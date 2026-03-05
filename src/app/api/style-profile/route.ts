import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import { hasEntitlement } from "@/lib/personalization/entitlements";
import { getStyleProfile, hasStyleProfileTable, isPersonalizationSchemaError, upsertStyleProfile } from "@/lib/personalization/profile";

function defaultProfile(userId: string) {
  return {
    userId,
    styleVibes: [],
    fitPreference: null,
    comfortFashion: 50,
    colorsLove: [],
    colorsAvoid: [],
    climate: null,
    budgetSensitivity: null,
    updatedAt: null,
  };
}

async function assertAccess(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const entitled = await hasEntitlement(userId, "personalization_memory", request);
  if (!entitled) return { error: NextResponse.json({ error: "Personalization memory is a premium feature" }, { status: 403 }) };

  return { userId };
}

export async function GET(request: Request) {
  const access = await assertAccess(request);
  if ("error" in access) return access.error;

  try {
    const schemaReady = await hasStyleProfileTable();
    if (!schemaReady) {
      console.warn("ROOT_CAUSE: style-profile PERSONALIZATION_SCHEMA_PENDING user_style_profile table missing");
      return NextResponse.json(
        { error: "Style profile temporarily unavailable while database migrates", code: "PERSONALIZATION_SCHEMA_PENDING" },
        { status: 503 },
      );
    }

    const profile = await getStyleProfile(access.userId);
    const persisted = Boolean(profile.updatedAt);
    return NextResponse.json({ profile, meta: { persisted } });
  } catch (error) {
    if (isPersonalizationSchemaError(error)) {
      console.warn("ROOT_CAUSE: style-profile PERSONALIZATION_SCHEMA_PENDING schema mismatch during GET");
      return NextResponse.json(
        { error: "Style profile temporarily unavailable while database migrates", code: "PERSONALIZATION_SCHEMA_PENDING" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await assertAccess(request);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const schemaReady = await hasStyleProfileTable();
    if (!schemaReady) {
      console.warn("ROOT_CAUSE: style-profile PERSONALIZATION_SCHEMA_PENDING user_style_profile table missing");
      return NextResponse.json(
        { error: "Style profile temporarily unavailable while database migrates", code: "PERSONALIZATION_SCHEMA_PENDING" },
        { status: 503 },
      );
    }

    const profile = await upsertStyleProfile(access.userId, body);
    return NextResponse.json({ profile, meta: { persisted: true } });
  } catch (error) {
    if (isPersonalizationSchemaError(error)) {
      console.warn("ROOT_CAUSE: style-profile PERSONALIZATION_SCHEMA_PENDING schema mismatch during PATCH");
      return NextResponse.json(
        { error: "Style profile temporarily unavailable while database migrates", code: "PERSONALIZATION_SCHEMA_PENDING" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
