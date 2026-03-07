import OpenAI from "openai";
import { z } from "zod";

import {
  VISUAL_REVIEW_CONFIDENCE_THRESHOLD,
  VISUAL_REVIEW_FIELDS,
  type VisualReviewField,
} from "@/lib/visualAwareness";

const DEFAULT_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

const confidenceSchema = z.number().min(0).max(1);

const analysisSchema = z.object({
  category: z.string().min(1).nullable(),
  subcategory: z.string().min(1).nullable(),
  primaryColor: z.string().min(1).nullable(),
  secondaryColors: z.array(z.string().min(1)).max(4),
  pattern: z.string().min(1).nullable(),
  material: z.string().min(1).nullable(),
  seasonality: z.array(z.string().min(1)).max(4),
  styleTags: z.array(z.string().min(1)).max(6),
  brandCandidate: z.string().min(1).nullable(),
  sizeEstimateCandidate: z.string().min(1).nullable(),
  overallConfidence: confidenceSchema,
  fieldConfidence: z.record(z.string(), confidenceSchema),
  needsReviewFields: z.array(z.enum(VISUAL_REVIEW_FIELDS)).max(VISUAL_REVIEW_FIELDS.length),
});

export type VisionAnalysisResult = z.infer<typeof analysisSchema>;

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return "{}";
}

function sanitizeRawPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  return serialized.length > 8000 ? `${serialized.slice(0, 8000)}...` : serialized;
}

function conservativeNeedsReview(result: VisionAnalysisResult): VisualReviewField[] {
  const needsReview = new Set<VisualReviewField>(result.needsReviewFields ?? []);
  for (const field of VISUAL_REVIEW_FIELDS) {
    const value = (result as any)[field];
    const conf = result.fieldConfidence[field] ?? 0;
    if (value == null || (Array.isArray(value) && value.length === 0) || conf < VISUAL_REVIEW_CONFIDENCE_THRESHOLD) {
      needsReview.add(field);
    }
  }
  return [...needsReview];
}

export async function runWardrobeVisionAnalysis(imageUrl: string): Promise<{ analysis: VisionAnalysisResult; rawModelPayload: string }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const schema = {
    name: "wardrobe_item_visual_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: ["string", "null"] },
        subcategory: { type: ["string", "null"] },
        primaryColor: { type: ["string", "null"] },
        secondaryColors: { type: "array", items: { type: "string" }, maxItems: 4 },
        pattern: { type: ["string", "null"] },
        material: { type: ["string", "null"] },
        seasonality: { type: "array", items: { type: "string" }, maxItems: 4 },
        styleTags: { type: "array", items: { type: "string" }, maxItems: 6 },
        brandCandidate: { type: ["string", "null"] },
        sizeEstimateCandidate: { type: ["string", "null"] },
        overallConfidence: { type: "number", minimum: 0, maximum: 1 },
        fieldConfidence: {
          type: "object",
          additionalProperties: { type: "number", minimum: 0, maximum: 1 },
        },
        needsReviewFields: {
          type: "array",
          items: { type: "string", enum: VISUAL_REVIEW_FIELDS },
        },
      },
      required: [
        "category",
        "subcategory",
        "primaryColor",
        "secondaryColors",
        "pattern",
        "material",
        "seasonality",
        "styleTags",
        "brandCandidate",
        "sizeEstimateCandidate",
        "overallConfidence",
        "fieldConfidence",
        "needsReviewFields",
      ],
    },
    strict: true,
  } as const;

  const completion = await client.chat.completions.create({
    model: DEFAULT_VISION_MODEL,
    temperature: 0,
    response_format: { type: "json_schema", json_schema: schema },
    messages: [
      {
        role: "system",
        content:
          "You are a conservative clothing vision analyst. Return strict JSON only. Use null when unclear. Never overstate confidence. Brand and size should usually be low-confidence unless text/logo/label is clearly visible.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this single clothing image and return structured garment metadata with realistic confidence values.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  const rawMessage = completion.choices[0]?.message?.content || "{}";
  const rawJson = extractJsonObject(rawMessage);
  const parsed = analysisSchema.safeParse(JSON.parse(rawJson));
  if (!parsed.success) {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  const withReviewFields = {
    ...parsed.data,
    needsReviewFields: conservativeNeedsReview(parsed.data),
  };

  return {
    analysis: withReviewFields,
    rawModelPayload: sanitizeRawPayload(withReviewFields),
  };
}
