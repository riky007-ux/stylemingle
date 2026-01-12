import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, ratings } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "secret";

function getUserId(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    return decoded.userId as string;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await db
    .select()
    .from(outfits)
    .where(eq(outfits.userId, userId))
    .orderBy(desc(outfits.createdAt));
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, itemIds } = body;

  const newOutfit = {
    id: crypto.randomUUID(),
    userId,
    name,
    description,
    itemIds,
    createdAt: new Date(),
  };

  await db.insert(outfits).values(newOutfit);

  return NextResponse.json(newOutfit);
}
