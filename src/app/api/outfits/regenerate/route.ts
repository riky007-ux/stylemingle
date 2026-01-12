import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, wardrobe_items } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "secret";

function getUserId(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded: any = jwt.verify(token, SECRET);
    return decoded.userId || decoded.id || decoded.sub || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const { outfitId, instruction } = body || {};
  if (!outfitId) {
    return NextResponse.json({ message: "outfitId is required" }, { status: 400 });
  }
  // Fetch original outfit
  const orig = await db.select().from(outfits).where(eq(outfits.id, outfitId));
  const original = orig[0];
  if (!original || (original.userId && original.userId !== userId)) {
    return NextResponse.json({ message: "Outfit not found" }, { status: 404 });
  }
  const itemIds = Array.isArray(original.itemIds) ? original.itemIds : [];
  // Fetch wardrobe items info
  const wardrobeItems = await db
    .select()
    .from(wardrobe_items)
    .where(inArray(wardrobe_items.id, itemIds));
  const itemsList = wardrobeItems.map((item: any) => `${item.id}: ${item.description}`);
  const itemsString = itemsList.join("\n");
  // Build prompt
  let userPrompt = `Given the following wardrobe items, suggest a new outfit. Only use the provided item ids. Provide output in JSON with keys name, description, items.`;
  if (instruction && typeof instruction === "string" && instruction.trim() !== "") {
    userPrompt += ` Please make it ${instruction.trim()}.`;
  }
  userPrompt += `\n\nWardrobe Items:\n${itemsString}`;
  const systemPrompt = "You are a helpful assistant that suggests outfits using provided wardrobe items.";
  const openai = new OpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });
  const message = completion.choices[0].message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    return NextResponse.json({ message: "Failed to parse OpenAI response", raw: message }, { status: 500 });
  }
  if (!parsed || !parsed.name || !parsed.description || !Array.isArray(parsed.items)) {
    return NextResponse.json({ message: "Invalid response from OpenAI", raw: parsed }, { status: 500 });
  }
  const [newOutfit] = await db
    .insert(outfits)
    .values({
      id: randomUUID(),
      userId,
      name: parsed.name,
      description: parsed.description,
      itemIds: parsed.items,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .returning();
  return NextResponse.json(newOutfit, { status: 200 });
}
