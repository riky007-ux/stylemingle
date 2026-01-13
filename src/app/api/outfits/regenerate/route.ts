import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, wardrobe_items } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const userId = getUserIdFromAuthHeader(req.headers);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { outfitId, instruction } = body;

  if (!outfitId) {
    return NextResponse.json(
      { error: "Missing outfitId" },
      { status: 400 }
    );
  }

  // Fetch original outfit
  const [originalOutfit] = await db
    .select()
    .from(outfits)
    .where(eq(outfits.id, outfitId));

  if (!originalOutfit || originalOutfit.userId !== userId) {
    return NextResponse.json(
      { error: "Outfit not found" },
      { status: 404 }
    );
  }

  // Fetch wardrobe items
  const items = await db
    .select()
    .from(wardrobe_items)
    .where(eq(wardrobe_items.userId, userId));

  if (items.length < 2) {
    return NextResponse.json(
      { error: "Not enough wardrobe items" },
      { status: 400 }
    );
  }

  const prompt = `
You are a personal stylist.

Wardrobe items:
${items
  .map(
    (i) =>
      `- ${i.category ?? "item"} (${i.color ?? "unknown color"}, ${
        i.style ?? "unknown style"
      })`
  )
  .join("\n")}

Original outfit:
Name: ${originalOutfit.name}
Description: ${originalOutfit.description}

User instruction:
${instruction ?? "Improve this outfit creatively."}

Return JSON with:
{
  "name": "...",
  "description": "...",
  "items": ["wardrobe_item_id_1", "wardrobe_item_id_2"]
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  let parsed;
  try {
    parsed = JSON.parse(completion.choices[0].message.content || "");
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    );
  }

  if (
    !parsed?.name ||
    !parsed?.description ||
    !Array.isArray(parsed.items)
  ) {
    return NextResponse.json(
      { error: "Invalid AI response" },
      { status: 500 }
    );
  }

  const [newOutfit] = await db
    .insert(outfits)
    .values({
      id: randomUUID(),
      userId,
      name: parsed.name,
      description: parsed.description,
      itemIds: JSON.stringify(parsed.items),
      createdAt: new Date(), // ✅ FIXED
    })
    .returning();

  return NextResponse.json(newOutfit, { status: 200 });
}
