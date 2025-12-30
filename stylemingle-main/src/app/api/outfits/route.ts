export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outfits } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const SECRET = process.env.NEXTAUTH_SECRET || 'secret';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

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
  const list = await db.select().from(outfits).where(eq(outfits.userId, userId));
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { itemIds } = body;
  const prompt = `Create a stylish outfit description for the following wardrobe item IDs: ${Array.isArray(itemIds) ? itemIds.join(', ') : ''}. Provide a concise outfit name and description.`;
  let aiResponse = '';
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
      }),
    });
    const json = await resp.json();
    aiResponse = json?.choices?.[0]?.message?.content || '';
  } catch (err) {
    aiResponse = 'Unable to generate outfit description.';
  }
  const id = crypto.randomUUID();
  const [outfit] = await db
    .insert(outfits)
    .values({ id, userId, itemIds, description: aiResponse, createdAt: Date.now() })
    .returning();
  return NextResponse.json(outfit);
}
