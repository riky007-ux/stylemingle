import OpenAI from "openai";

export const CATEGORY_VALUES = ["top", "bottom", "shoes", "outerwear", "accessory", "other", "unknown"] as const;
export const COLOR_VALUES = [
  "black",
  "white",
  "gray",
  "navy",
  "blue",
  "green",
  "red",
  "brown",
  "beige",
  "cream",
  "pink",
  "purple",
  "yellow",
  "orange",
  "multicolor",
  "unknown",
] as const;
export const STYLE_VALUES = [
  "casual",
  "formal",
  "streetwear",
  "athleisure",
  "business",
  "evening",
  "minimal",
  "vintage",
  "outdoors",
  "unknown",
] as const;

export type TaggingResult = {
  itemId: string;
  category: (typeof CATEGORY_VALUES)[number];
  primaryColor: (typeof COLOR_VALUES)[number];
  styleTag: (typeof STYLE_VALUES)[number];
};

const DEFAULT_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T[number]) : fallback;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return "{}";
}

function normalizeTaggingResult(raw: any): TaggingResult {
  return {
    itemId: String(raw?.itemId || ""),
    category: normalizeEnum(raw?.category, CATEGORY_VALUES, "unknown"),
    primaryColor: normalizeEnum(raw?.primaryColor, COLOR_VALUES, "unknown"),
    styleTag: normalizeEnum(raw?.styleTag, STYLE_VALUES, "unknown"),
  };
}

export async function runVisionTagging(inputs: Array<{ itemId: string; imageUrl: string }>) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const schema = {
    name: "wardrobe_tagging",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          minItems: inputs.length,
          maxItems: inputs.length,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              itemId: { type: "string" },
              category: { type: "string", enum: CATEGORY_VALUES },
              primaryColor: { type: "string", enum: COLOR_VALUES },
              styleTag: { type: "string", enum: STYLE_VALUES },
            },
            required: ["itemId", "category", "primaryColor", "styleTag"],
          },
        },
      },
      required: ["items"],
    },
    strict: true,
  } as const;

  const completion = await client.chat.completions.create({
    model: DEFAULT_VISION_MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: schema,
    },
    messages: [
      {
        role: "system",
        content:
          "You are a fashion tagging assistant. Return strict JSON only. Infer clothing category, primaryColor, and styleTag from each image. If uncertain use unknown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Tag each wardrobe image. Use the itemId exactly as provided.",
          },
          ...inputs.flatMap((input) => [
            { type: "text" as const, text: `itemId=${input.itemId}` },
            { type: "image_url" as const, image_url: { url: input.imageUrl } },
          ]),
        ],
      },
    ],
  });

  const raw = extractJsonObject(completion.choices[0]?.message?.content || "{}");
  const parsed = JSON.parse(raw);
  const taggedItems = Array.isArray(parsed?.items) ? parsed.items.map(normalizeTaggingResult) : [];

  const byId = new Map(taggedItems.map((item) => [item.itemId, item]));
  return inputs.map((input) => {
    const hit = byId.get(input.itemId);
    if (hit) return hit;
    return {
      itemId: input.itemId,
      category: "unknown",
      primaryColor: "unknown",
      styleTag: "unknown",
    } satisfies TaggingResult;
  });
}
