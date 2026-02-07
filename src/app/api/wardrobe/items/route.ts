import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/db";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

export async function GET() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = verifyToken(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return newest first (safe even if table is small)
  const rows = await db.execute({
    sql: `select id, userId, imageUrl, createdAt
          from wardrobe_items
          where userId = ?
          order by createdAt desc`,
    args: [userId],
  });

  return NextResponse.json(rows.rows ?? []);
}

export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = verifyToken(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const createdAt = Math.floor(Date.now() / 1000);

  try {
    await db.execute({
      sql: `insert into wardrobe_items (id, userId, imageUrl, createdAt)
            values (?, ?, ?, ?)`,
      args: [id, userId, imageUrl, createdAt],
    });

    return NextResponse.json({ id, userId, imageUrl, createdAt }, { status: 201 });
  } catch (err) {
    console.error("WARDROBE_ITEMS_INSERT_FAILED", err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
