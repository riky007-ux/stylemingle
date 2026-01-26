import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { db } from '@/lib/db';
import { wardrobe_items } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromAuthHeader(request.headers);
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Fetch wardrobe items for the user
  const items = await db
    .select()
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId));

  if (!items || items.length === 0) {
    return NextResponse.json(
      { message: 'Your wardrobe is empty. Please add items before generating an outfit.' },
      { status: 400 },
    );
  }

  if (items.length < 2) {
    return NextResponse.json(
      { message: 'You need at least two items in your wardrobe to generate an outfit.' },
      { status: 400 },
    );
  }

  // Stub response: outfit generation is disabled for this preview build
  return NextResponse.json({ message: 'Outfit generation is currently disabled.' }, { status: 200 });
}
