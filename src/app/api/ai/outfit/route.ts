import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { randomUUID } from "crypto";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { outfits, wardrobe_items } from "@/lib/schema";

type Category = "top" | "bottom" | "shoes" | "outerwear";

type OutfitItem = {
  id: string;
  imageUrl: string;
  category: string | null;
  primaryColor: string | null;
  styleTag: string | null;
};

type OutfitResponse = {
  top: OutfitItem | null;
  bottom: OutfitItem | null;
  shoes: OutfitItem | null;
  outerwear: OutfitItem | null;
  explanation: string[];
  followUpQuestion: string;
  source: "fallback" | "openai";
};

function getUserId() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function pickByCategory(items: OutfitItem[], category: Category) {
  return items.find((i) => i.category === category) ?? null;
}

function isMissingColumnError(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return msg.includes("no such column") || msg.includes("has no column named") || msg.includes("no such table") || msg.includes("sqlite_error");
}

function normalizeExplanation(explanation: unknown): string[] {
  if (Array.isArray(explanation)) {
    return explanation.filter((line): line is string => typeof line === "string" && line.trim().length > 0);
  }

  if (typeof explanation === "string" && explanation.trim().length > 0) {
    return [explanation.trim()];
  }

  return [];
}

export async function POST(request: Request) {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { occasion, weather, mood } = body;

  let items: OutfitItem[] = [];
  try {
    items = (await db
      .select()
      .from(wardrobe_items)
      .where(and(eq(wardrobe_items.userId, userId), inArray(wardrobe_items.category, ["top", "bottom", "shoes", "outerwear"])))
      .orderBy(desc(wardrobe_items.createdAt))) as OutfitItem[];
  } catch (error) {
    if (isMissingColumnError(error)) {
      try {
        const legacy = await db.$client.execute({
          sql: "SELECT id, imageUrl, category, color, style, createdAt FROM wardrobe_items WHERE userId = ? ORDER BY createdAt DESC",
          args: [userId],
        });
        items = (legacy.rows || []).map((row: any) => ({
          id: row.id,
          imageUrl: row.imageUrl,
          category: row.category ?? null,
          primaryColor: row.color ?? null,
          styleTag: row.style ?? null,
        }));
      } catch {
        return NextResponse.json(
          {
            error: "We’re upgrading your closet. Try again in a moment.",
            code: "DB_MIGRATION_REQUIRED",
          },
          { status: 503 }
        );
      }
    } else {
      return NextResponse.json({ error: "Failed to read wardrobe metadata" }, { status: 500 });
    }
  }

  const hasBasics = ["top", "bottom", "shoes"].every((cat) => items.some((i) => i.category === cat));
  if (!hasBasics) {
    return NextResponse.json({ error: "Please tag at least one top, bottom, and shoes item before generating." }, { status: 400 });
  }

  const fallback: OutfitResponse = {
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

  let result: OutfitResponse = fallback;

  if (process.env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const compactItems = items.map((i) => ({ id: i.id, category: i.category, primaryColor: i.primaryColor, styleTag: i.styleTag }));

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a safe stylist assistant. Return JSON only with keys: topId,bottomId,shoesId,outerwearId(optional),explanation(array of short bullets),followUpQuestion.",
          },
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
        explanation: normalizeExplanation(parsed.explanation),
        followUpQuestion:
          typeof parsed.followUpQuestion === "string" && parsed.followUpQuestion.trim().length > 0
            ? parsed.followUpQuestion
            : fallback.followUpQuestion,
        source: "openai",
      };
    } catch {
      result = fallback;
    }
  }

  try {
    await db.insert(outfits).values({
      id: randomUUID(),
      userId,
      name: `Outfit for ${occasion || "everyday"}`,
      description: "AI stylist generated outfit",
      itemIds: JSON.stringify([result.top?.id, result.bottom?.id, result.shoes?.id, result.outerwear?.id].filter(Boolean)),
      promptJson: JSON.stringify({ occasion, weather, mood }),
      explanation: result.explanation.join(" "),
      createdAt: new Date(),
    });
  } catch {}

  return NextResponse.json(result);
}
