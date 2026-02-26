import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { runVisionTagging } from "../tagging";

const MAX_BATCH = 6;

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }

  let body: { itemIds?: string[]; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const incomingIds = Array.isArray(body.itemIds) ? body.itemIds.filter((id): id is string => typeof id === "string") : [];
  if (incomingIds.length === 0) {
    return NextResponse.json({ updated: [], skipped: [] });
  }

  const ownedItems = await db
    .select()
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.userId, userId), inArray(wardrobe_items.id, incomingIds)))
    .orderBy(desc(wardrobe_items.createdAt));

  const skipped: string[] = [];
  const candidates = ownedItems
    .filter((item) => {
      const complete = Boolean(item.category && item.primaryColor && item.styleTag);
      if (complete && !body.force) {
        skipped.push(item.id);
        return false;
      }
      return Boolean(item.imageUrl);
    })
    .slice(0, MAX_BATCH);

  if (candidates.length === 0) {
    return NextResponse.json({ updated: [], skipped });
  }

  try {
    const taggings = await runVisionTagging(candidates.map((item) => ({ itemId: item.id, imageUrl: item.imageUrl })));

    const tagById = new Map(taggings.map((tag) => [tag.itemId, tag]));
    const updated = [];

    for (const item of candidates) {
      const tagging = tagById.get(item.id);
      if (!tagging) continue;

      const [row] = await db
        .update(wardrobe_items)
        .set({
          category: item.category && !body.force ? item.category : tagging.category,
          primaryColor: item.primaryColor && !body.force ? item.primaryColor : tagging.primaryColor,
          styleTag: item.styleTag && !body.force ? item.styleTag : tagging.styleTag,
        })
        .where(and(eq(wardrobe_items.id, item.id), eq(wardrobe_items.userId, userId)))
        .returning();

      if (row) updated.push(row);
    }

    return NextResponse.json({ updated, skipped });
  } catch (error) {
    console.error("tag_batch_failed", error);
    return NextResponse.json({ error: "Tagging failed" }, { status: 500 });
  }
}
