import OpenAI from "openai";
import { z } from "zod";

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

export const VisionTaggingResultSchema = z.object({
  itemId: z.string().min(1),
  category: z.enum(CATEGORY_VALUES),
  primaryColor: z.enum(COLOR_VALUES),
  styleTag: z.enum(STYLE_VALUES),
});

export type VisionTaggingResult = z.infer<typeof VisionTaggingResultSchema>;

const VisionTaggingPayloadSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      category: z.enum(CATEGORY_VALUES).optional(),
      primaryColor: z.enum(COLOR_VALUES).optional(),
      styleTag: z.enum(STYLE_VALUES).optional(),
    })
  ),
});

const DEFAULT_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

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

export async function runVisionTagging(inputs: Array<{ itemId: string; imageUrl: string }>): Promise<VisionTaggingResult[]> {
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
  const parsed = VisionTaggingPayloadSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("Invalid tagging payload");
  }

  const parsedById = new Map<
    string,
    {
      category?: VisionTaggingResult["category"];
      primaryColor?: VisionTaggingResult["primaryColor"];
      styleTag?: VisionTaggingResult["styleTag"];
    }
  >();

  for (const item of parsed.data.items) {
    parsedById.set(item.itemId, {
      category: item.category,
      primaryColor: item.primaryColor,
      styleTag: item.styleTag,
    });
  }

  return inputs.map((input) => {
    const match = parsedById.get(input.itemId);

    return VisionTaggingResultSchema.parse({
      itemId: input.itemId,
      category: match?.category ?? "unknown",
      primaryColor: match?.primaryColor ?? "unknown",
      styleTag: match?.styleTag ?? "unknown",
    });
  });
}
