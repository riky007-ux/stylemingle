import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wardrobe_items } from '@/lib/schema';
import { getUserIdFromAuthHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = getUserIdFromAuthHeader(req.headers);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== 'string') {
    return NextResponse.json({ error: 'Invalid imageUrl' }, { status: 400 });
  }
  const createdAt = new Date();
  try {
    await db.insert(wardrobe_items).values({
      userId,
      imageUrl,
      createdAt,
    });
    return NextResponse.json({ imageUrl, createdAt });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
