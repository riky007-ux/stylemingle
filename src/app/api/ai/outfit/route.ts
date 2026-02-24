import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { randomUUID } from "crypto";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { outfits, wardrobe_items } from "@/lib/schema";

type Category = "top" | "bottom" | "shoes" | "outerwear";

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function pickByCategory(items: any[], category: Category) {
  return items.filter((i) => i.category === category)[0] ?? null;
}

export async function POST(request: Request) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { occasion, weather, mood } = body;

  const items = await db
    .select()
    .from(wardrobe_items)
    .where(and(eq(wardrobe_items.userId, userId), inArray(wardrobe_items.category, ["top", "bottom", "shoes", "outerwear"])) )
    .orderBy(desc(wardrobe_items.createdAt));

  const hasBasics = ["top", "bottom", "shoes"].every((cat) => items.some((i) => i.category === cat));
  if (!hasBasics) {
    return NextResponse.json({ error: "Please tag at least one top, bottom, and shoes item before generating." }, { status: 400 });
  }

  const fallback = {
    top: pickByCategory(items, "top"),
    bottom: pickByCategory(items, "bottom"),
    shoes: pickByCategory(items, "shoes"),
    outerwear: pickByCategory(items, "outerwear"),
    explanation: [
      "Built from your most recent tagged basics.",
      "This combination balances silhouette and color flexibility.",
    ],
    followUpQuestion: "Want this tuned for a specific venue or temperature?",
    source: "fallback",
  };

  let result = fallback;

  if (process.env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const compactItems = items.map((i) => ({ id: i.id, category: i.category, primaryColor: i.primaryColor, styleTag: i.styleTag }));

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a safe stylist assistant. Return JSON only with keys: topId,bottomId,shoesId,outerwearId(optional),explanation(array of short bullets),followUpQuestion." },
          { role: "user", content: JSON.stringify({ occasion, weather, mood, items: compactItems }) },
        ],
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      const byId = Object.fromEntries(items.map((i) => [i.id, i]));
      result = {
        top: byId[parsed.topId] ?? fallback.top,
        bottom: byId[parsed.bottomId] ?? fallback.bottom,
        shoes: byId[parsed.shoesId] ?? fallback.shoes,
        outerwear: byId[parsed.outerwearId] ?? fallback.outerwear,
        explanation: parsed.explanation ?? fallback.explanation,
        followUpQuestion: parsed.followUpQuestion ?? fallback.followUpQuestion,
        source: "openai",
      };
    } catch {
      result = fallback;
    }
  }

  await db.insert(outfits).values({
    id: randomUUID(),
    userId,
    name: `Outfit for ${occasion || "everyday"}`,
    description: "AI stylist generated outfit",
    itemIds: JSON.stringify([result.top?.id, result.bottom?.id, result.shoes?.id, result.outerwear?.id].filter(Boolean)),
    promptJson: JSON.stringify({ occasion, weather, mood }),
    explanation: Array.isArray(result.explanation) ? result.explanation.join(" ") : String(result.explanation),
    createdAt: new Date(),
  });

  return NextResponse.json(result);
}
