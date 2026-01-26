import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req.headers);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ message: 'Outfit regeneration is currently disabled.' }, { status: 200 });
}
