import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { wardrobe_items } from '@/lib/schema';

/**
 * GET /api/wardrobe/items
 */
export async function GET() {
  const token = cookies().get('token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await db
    .select()
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId));

  return NextResponse.json(items);
}

/**
 * POST /api/wardrobe/items
 *
 * Persists a newly uploaded wardrobe item.
 * Schema requires id + userId + createdAt + imageUrl.
 */
export async function POST(request: Request) {
  const token = cookies().get('token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { imageUrl } = body ?? {};
  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
  }

  const [item] = await db
    .insert(wardrobe_items)
    .values({
      id: randomUUID(),
      userId,
      createdAt: new Date(),
      imageUrl,
    })
    .returning();

  return NextResponse.json(item);
}

/**
 * DELETE /api/wardrobe/items
 */
export async function DELETE(request: Request) {
  const token = cookies().get('token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  let id = url.searchParams.get('id');

  if (!id) {
    try {
      const body = await request.json();
      id = body?.id;
    } catch {}
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  await db
    .delete(wardrobe_items)
    .where(
      and(
        eq(wardrobe_items.id, id),
        eq(wardrobe_items.userId, userId)
      )
    );

  return NextResponse.json({ success: true });
}
