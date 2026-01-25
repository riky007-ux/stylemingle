import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.NEXTAUTH_SECRET || "secret";
const COOKIE_NAME = "auth";

function getUserId(req: NextRequest): string | null {
  const headerUserId = getUserIdFromAuthHeader(req.headers);
  if (headerUserId) return headerUserId;

  // Try reading from cookie via next/headers
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (cookie) {
      let token = cookie.value;
      if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }
      try {
        const decoded = jwt.verify(token, SECRET) as any;
        return decoded.userId as string;
      } catch {
        return null;
      }
    }
  } catch {
    // fallback using cookie header
    const cookieHeader = req.headers.get("cookie") || "";
    const authCookiePair = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (authCookiePair) {
      const cookieVal = decodeURIComponent(authCookiePair.split("=")[1] || "");
      let token = cookieVal;
      if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }
      try {
        const decoded = jwt.verify(token, SECRET) as any;
        return decoded.userId as string;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await db
      .select({
        id: wardrobe_items.id,
        imageUrl: wardrobe_items.imageUrl,
        createdAt: wardrobe_items.createdAt,
      })
      .from(wardrobe_items)
      .where(eq(wardrobe_items.userId, userId))
      .orderBy(desc(wardrobe_items.createdAt));
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/wardrobe/items failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
