import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/schema";

const PERSONALIZATION_ENTITLEMENT = "personalization_memory";

export type EntitlementName = typeof PERSONALIZATION_ENTITLEMENT;

export function hasProofTokenBypass(req: Request): boolean {
  const expected = process.env.PERSONALIZATION_PROOF_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-stylemingle-proof-token");
  return Boolean(provided && provided === expected);
}

export async function hasEntitlement(userId: string, entitlement: EntitlementName): Promise<boolean> {
  if (entitlement !== PERSONALIZATION_ENTITLEMENT) return false;

  const row = await db
    .select({ isPremium: users.isPremium })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return Boolean(row[0]?.isPremium);
}
