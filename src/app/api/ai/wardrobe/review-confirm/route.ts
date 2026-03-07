import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_item_analysis } from "@/lib/schema";

export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const userId = token ? verifyToken(token) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { wardrobeItemId?: string } | null;
  if (!body?.wardrobeItemId) return NextResponse.json({ error: "Missing wardrobeItemId" }, { status: 400 });

  const [updated] = await db
    .update(wardrobe_item_analysis)
    .set({
      status: "complete",
      needsReviewFields: JSON.stringify([]),
      updatedAt: new Date(),
    })
    .where(and(eq(wardrobe_item_analysis.userId, userId), eq(wardrobe_item_analysis.wardrobeItemId, body.wardrobeItemId)))
    .returning()
    .catch(() => []);

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, status: updated.status, needsReviewFields: [] });
}
