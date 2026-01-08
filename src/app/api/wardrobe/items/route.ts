import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wardrobe_items } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { getUserIdFromAuthHeader } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = getUserIdFromAuthHeader(req.headers);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const items = await db
      .select()
      .from(wardrobe_items)
      .where(eq(wardrobe_items.userId, userId))
      .orderBy(desc(wardrobe_items.createdAt));
    const result = items.map((item: any) => ({
      id: item.id,
      imageUrl: item.imageUrl,
      createdAt: item.createdAt,
    }));
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
