import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const SECRET = process.env.NEXTAUTH_SECRET || 'secret';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const userId = email;
    // Ensure user exists in DB
    const existing = await db.select().from(users).where(eq(users.id, userId));
    if (existing.length === 0) {
      await db.insert(users).values({ id: userId, email, createdAt: new Date() });
    }
    const token = jwt.sign({ userId }, SECRET);
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
