import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE_NAME, signToken, getCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    // check if user already exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      createdAt: new Date(),
    });
    const token = signToken(userId);
    const res = NextResponse.json({ token }, { status: 200 });
    res.cookies.set(AUTH_COOKIE_NAME, token, getCookieOptions());
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
