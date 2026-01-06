import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import schema from '@/lib/schema';
const { outfits, ratings } = schema;
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
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

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await db.select().from(outfits).where(eq(outfits.userId, userId));
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemIds } = await req.json();
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: 'itemIds required' }, { status: 400 });
  }

  // Compute average rating for preference learning
  const prefs = await db
    .select({ rating: ratings.rating })
    .from(ratings)
    .where(eq(ratings.userId, userId));
  let avgRating = 0;
  if (prefs.length > 0) {
    avgRating = prefs.reduce((sum, r) => sum + r.rating, 0) / prefs.length;
  }

  let preferenceNote = '';
  if (avgRating >= 4) {
    preferenceNote = 'The user loves their past outfits; continue the successful style.';
  } else if (avgRating >= 3) {
    preferenceNote = 'The user somewhat likes their outfits; improve their style slightly.';
  } else {
    preferenceNote = 'The user has low satisfaction; suggest a new style that matches eco-friendly and minimalist aesthetics.';
  }

  const prompt = `Generate a stylish outfit description for wardrobe item IDs: ${itemIds.join(
    ', ',
  )}. ${preferenceNote}`;

  let description = '';
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a fashion stylist AI.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 100,
      }),
    });
    const data = await response.json();
    description = data.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error(err);
    description = 'A chic outfit ensemble.';
  }

  const id = crypto.randomUUID();
  const result = await db
    .insert(outfits)
    .values({ id, userId, itemIds: JSON.stringify(itemIds), description, createdAt: Date.now() })
    .returning();
  return NextResponse.json(result[0]);
}
