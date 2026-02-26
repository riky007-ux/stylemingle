import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function isSchemaMismatchError(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return msg.includes("no such column") || msg.includes("has no column named") || msg.includes("no such table") || msg.includes("sqlite_error");
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  try {
    const [updated] = await db
      .update(wardrobe_items)
      .set({
        category: body.category ?? null,
        primaryColor: body.primaryColor ?? null,
        styleTag: body.styleTag ?? null,
      })
      .where(and(eq(wardrobe_items.id, params.id), eq(wardrobe_items.userId, userId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      // Older schema used color/style.
      try {
        await db.$client.execute({
          sql: "UPDATE wardrobe_items SET category = ?, color = ?, style = ? WHERE id = ? AND userId = ?",
          args: [body.category ?? null, body.primaryColor ?? null, body.styleTag ?? null, params.id, userId],
        });

        return NextResponse.json({
          id: params.id,
          userId,
          category: body.category ?? null,
          primaryColor: body.primaryColor ?? null,
          styleTag: body.styleTag ?? null,
        });
      } catch {
        return NextResponse.json({ error: "Database migration required", code: "DB_MIGRATION_REQUIRED" }, { status: 503 });
      }
    }
    return NextResponse.json({ error: "Failed to save metadata" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = params.id;

  try {
    const item = await db
      .select({ id: wardrobe_items.id })
      .from(wardrobe_items)
      .where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)))
      .limit(1);

    if (!item || item.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(wardrobe_items).where(and(eq(wardrobe_items.id, itemId), eq(wardrobe_items.userId, userId)));

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
