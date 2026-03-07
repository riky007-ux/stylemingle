import { isEnabled } from "@/lib/featureFlags";

export const VISUAL_REVIEW_FIELDS = [
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
] as const;

export type VisualReviewField = (typeof VISUAL_REVIEW_FIELDS)[number];

export function isVisualAwarenessEnabled() {
  return isEnabled(process.env.VISUAL_AWARENESS_ENABLED);
}

export const VISUAL_REVIEW_CONFIDENCE_THRESHOLD = 0.7;

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function parseJsonMap(value: string | null | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, confidence]) => typeof confidence === "number")
    ) as Record<string, number>;
  } catch {
    return {};
  }
}
