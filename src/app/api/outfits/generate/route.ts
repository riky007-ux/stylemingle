import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { db } from '@/lib/db';
import { wardrobe_items, outfits } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  // Build descriptions for OpenAI prompt
  const itemDescriptions = items
    .map((item) => {
      return `ID: ${item.id}, category: ${item.category ?? 'unspecified'}, color: ${item.color ?? 'unspecified'}, style: ${item.style ?? 'unspecified'}, season: ${item.season ?? 'unspecified'}, notes: ${item.notes ?? ''}`;
    })
    .join('\n');

  const messages = [
    {
      role: 'system',
      content:
        'You are a helpful and creative fashion assistant. Given a list of wardrobe items with metadata, suggest a stylish outfit using two or more of the provided items. Respond strictly in JSON format with keys name, description, and items (an array of item IDs used). Do not invent any item IDs; use only those provided.',
    },
    {
      role: 'user',
      content: `Here are my wardrobe items:\n${itemDescriptions}\nGenerate an outfit suggestion.`,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    });
    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No content from OpenAI');
    }
    let outfit: any;
    try {
      outfit = JSON.parse(content);
    } catch (err) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        outfit = JSON.parse(match[0]);
      } else {
        throw err;
      }
    }
    if (!outfit.name || !outfit.description || !Array.isArray(outfit.items)) {
      throw new Error('Invalid response structure');
    }
    const validItemIds = new Set(items.map((item) => item.id));
    outfit.items = outfit.items.filter((id: string) => validItemIds.has(id));
    if (outfit.items.length < 2) {
      outfit.items = items.slice(0, 2).map((i) => i.id);
    }
    const outfitId = randomUUID();
    await db.insert(outfits).values({
      id: outfitId,
      userId,
      name: outfit.name,
      description: outfit.description,
      itemIds: JSON.stringify(outfit.items),
      createdAt: Math.floor(Date.now() / 1000),
    });
    return NextResponse.json({
      name: outfit.name,
      description: outfit.description,
      items: outfit.items,
    });
  } catch (error) {
    console.error('Error generating outfit', error);
    return NextResponse.json(
      { message: 'Failed to generate outfit. Please try again later.' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
