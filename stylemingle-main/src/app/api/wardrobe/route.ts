export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wardrobeItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const SECRET = process.env.NEXTAUTH_SECRET || 'secret';

function getUserIdFromAuth(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  const [type, token] = auth.split(' ');
  if (type !== 'Bearer' || !token) return null;
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    return decoded.userId as string;
  } catch (err) {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await db.select().from(wardrobeItems).where(eq(wardrobeItems.userId, userId));
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { imageUrl, description } = body;
  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const [item] = await db
    .insert(wardrobeItems)
    .values({ id, userId, imageUrl, description, createdAt: Date.now() })
    .returning();
  return NextResponse.json(item);
}
