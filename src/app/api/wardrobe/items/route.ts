import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

function getUserId(req: NextRequest): string | null {
  // Try Authorization header
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader) {
    let token = authHeader;
    if (token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }
    try {
      const decoded = verifyToken(token) as any;
      return decoded.userId as string;
    } catch (e) {
      // ignore and fallback
    }
  }
  // Try cookie
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (cookie) {
    let token = cookie.value;
    if (token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }
    try {
      const decoded = verifyToken(token) as any;
      return decoded.userId as string;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await db
    .select()
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId))
    .orderBy(desc(wardrobe_items.createdAt));
  return NextResponse.json(items, { status: 200 });
}
