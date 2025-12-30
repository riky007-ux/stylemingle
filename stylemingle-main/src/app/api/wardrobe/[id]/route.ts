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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  const body = await request.json();
  const { imageUrl, description } = body;
  await db.update(wardrobeItems).set({ imageUrl, description }).where(eq(wardrobeItems.id, id));
  const [item] = await db.select().from(wardrobeItems).where(eq(wardrobeItems.id, id));
  return NextResponse.json(item);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  await db.delete(wardrobeItems).where(eq(wardrobeItems.id, id));
  return NextResponse.json({ success: true });
}
