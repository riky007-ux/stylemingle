import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/schema";

const PERSONALIZATION_ENTITLEMENT = "personalization_memory";

export type EntitlementName = typeof PERSONALIZATION_ENTITLEMENT;

function isEntitlementReadSafeFailure(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("no such column") ||
    message.includes("has no column named") ||
    message.includes("no such table") ||
    message.includes("sqlite_error") ||
    message.includes("timeout") ||
    message.includes("network")
  );
}

export function hasProofTokenBypass(req: Request): boolean {
  const expected = process.env.PERSONALIZATION_PROOF_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-stylemingle-proof-token");
  return Boolean(provided && provided === expected);
}

export async function hasEntitlement(userId: string, entitlement: EntitlementName, req?: Request): Promise<boolean> {
  if (entitlement !== PERSONALIZATION_ENTITLEMENT) return false;

  if (req && hasProofTokenBypass(req)) {
    return true;
  }

  try {
    const row = await db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return Boolean(row[0]?.isPremium);
  } catch (error) {
    if (isEntitlementReadSafeFailure(error)) {
      console.warn("[personalization] entitlement read unavailable; defaulting to false");
      return false;
    }

    console.warn("[personalization] entitlement read failed; defaulting to false");
    return false;
  }
}
