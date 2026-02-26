import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { runVisionTagging } from "../tagging";

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

  let body: { itemId?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.id, body.itemId), eq(wardrobe_items.userId, userId)))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!item.imageUrl) {
    return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
  }

  const hasExisting = Boolean(item.category && item.primaryColor && item.styleTag);
  if (hasExisting && !body.force) {
    return NextResponse.json(item);
  }

  try {
    const [tagging] = await runVisionTagging([{ itemId: item.id, imageUrl: item.imageUrl }]);

    const [updated] = await db
      .update(wardrobe_items)
      .set({
        category: item.category && !body.force ? item.category : tagging.category,
        primaryColor: item.primaryColor && !body.force ? item.primaryColor : tagging.primaryColor,
        styleTag: item.styleTag && !body.force ? item.styleTag : tagging.styleTag,
      })
      .where(and(eq(wardrobe_items.id, item.id), eq(wardrobe_items.userId, userId)))
      .returning();

    return NextResponse.json(updated || item);
  } catch (error) {
    console.error("tagging_failed", error);
    return NextResponse.json({ error: "Tagging failed" }, { status: 500 });
  }
}
