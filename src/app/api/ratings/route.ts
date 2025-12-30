import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ratings } from '@/lib/schema';
import jwt from 'jsonwebtoken';

const SECRET = process.env.NEXTAUTH_SECRET || 'secret';

function getUserId(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    return decoded.userId as string;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { outfitId, rating } = body;
  if (!outfitId || typeof rating !== 'number') {
    return NextResponse.json({ error: 'outfitId and rating required' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const result = await db
    .insert(ratings)
    .values({ id, userId, outfitId, rating })
    .returning();
  return NextResponse.json(result[0]);
}
