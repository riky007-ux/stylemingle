import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { AUTH_COOKIE_NAME, verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { wardrobe_items } from '@/lib/schema';

function isMissingColumnError(error: unknown) {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('no such column') || msg.includes('has no column named');
}

function migrationRequiredResponse() {
  return NextResponse.json(
    { error: 'Database migration required', code: 'DB_MIGRATION_REQUIRED' },
    { status: 503 }
  );
}

/**
 * GET /api/wardrobe/items
 */
export async function GET() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const items = await db
      .select()
      .from(wardrobe_items)
      .where(eq(wardrobe_items.userId, userId));

    return NextResponse.json(items);
  } catch (error) {
    if (isMissingColumnError(error)) {
      const legacyItems = await db.execute({
        sql: 'SELECT id, userId, imageUrl, createdAt FROM wardrobe_items WHERE userId = ? ORDER BY createdAt DESC',
        args: [userId],
      });

      const rows = (legacyItems.rows || []).map((row: any) => ({
        id: row.id,
        userId: row.userId,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt,
        category: null,
        primaryColor: null,
        styleTag: null,
      }));
      return NextResponse.json(rows);
    }

    return NextResponse.json({ error: 'Failed to load wardrobe items' }, { status: 500 });
  }
}

/**
 * POST /api/wardrobe/items
 */
export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
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

  const id = randomUUID();
  const createdAt = new Date();

  try {
    const [item] = await db
      .insert(wardrobe_items)
      .values({
        id,
        userId,
        createdAt,
        imageUrl,
      })
      .returning();

    return NextResponse.json(item);
  } catch (error) {
    if (isMissingColumnError(error)) {
      try {
        await db.execute({
          sql: 'INSERT INTO wardrobe_items (id, userId, imageUrl, createdAt) VALUES (?, ?, ?, ?)',
          args: [id, userId, imageUrl, createdAt.getTime()],
        });

        return NextResponse.json({
          id,
          userId,
          imageUrl,
          createdAt,
          category: null,
          primaryColor: null,
          styleTag: null,
        });
      } catch {
        return migrationRequiredResponse();
      }
    }

    return NextResponse.json({ error: 'Failed to save wardrobe item' }, { status: 500 });
  }
}

/**
 * DELETE /api/wardrobe/items
 */
export async function DELETE(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
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
