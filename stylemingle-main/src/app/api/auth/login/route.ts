export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = existing[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const secret = process.env.NEXTAUTH_SECRET || 'secret';
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });
    return NextResponse.json({ token }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
