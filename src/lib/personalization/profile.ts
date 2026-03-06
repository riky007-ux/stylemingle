import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { ratings, user_style_profile } from "@/lib/schema";

type ProfilePatch = {
  styleVibes?: string[];
  fitPreference?: string | null;
  comfortFashion?: number;
  colorsLove?: string[];
  colorsAvoid?: string[];
  climate?: string | null;
  budgetSensitivity?: string | null;
};

type FeedbackBias = {
  formalityBias: number;
  avoidColorsCount: number;
  recentFeedbackCount: number;
  avgRating: number;
};

export type StyleProfileResult = {
  userId: string;
  styleVibes: string[];
  fitPreference: string | null;
  comfortFashion: number;
  colorsLove: string[];
  colorsAvoid: string[];
  climate: string | null;
  budgetSensitivity: string | null;
  updatedAt: Date | null;
};

const MAX_FEEDBACK_ROWS = 25;

function asStringArray(value: string | null | undefined, fallback: string[] = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((v): v is string => typeof v === "string").slice(0, 15);
  } catch {
    return fallback;
  }
}

function clampComfortFashion(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isPersonalizationSchemaError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("no such table") ||
    message.includes("no such column") ||
    message.includes("has no column named") ||
    message.includes("sqlite_error")
  );
}

export async function getTableColumns(table: string) {
  const result = await db.$client.execute(`PRAGMA table_info(${table});`);
  return (result.rows || []).map((row: any) => String(row?.name || "")).filter(Boolean);
}

export async function hasStyleProfileTable() {
  const tables = await db.$client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_style_profile' LIMIT 1");
  return Boolean((tables.rows || [])[0]);
}

export async function hasFeedbackColumns() {
  const columns = await getTableColumns("ratings");
  return columns.includes("reasons") && columns.includes("note");
}

function defaultProfile(userId: string): StyleProfileResult {
  return {
    userId,
    styleVibes: [],
    fitPreference: null,
    comfortFashion: 50,
    colorsLove: [],
    colorsAvoid: [],
    climate: null,
    budgetSensitivity: null,
    updatedAt: null,
  };
}

export async function getStyleProfile(userId: string) {
  const rows = await db.select().from(user_style_profile).where(eq(user_style_profile.userId, userId)).limit(1);
  const record = rows[0];
  if (!record) return defaultProfile(userId);

  return {
    userId,
    styleVibes: asStringArray(record.styleVibes),
    fitPreference: record.fitPreference,
    comfortFashion: clampComfortFashion(record.comfortFashion),
    colorsLove: asStringArray(record.colorsLove),
    colorsAvoid: asStringArray(record.colorsAvoid),
    climate: record.climate,
    budgetSensitivity: record.budgetSensitivity,
    updatedAt: record.updatedAt,
  };
}

export async function upsertStyleProfile(userId: string, patch: ProfilePatch) {
  const existing = await getStyleProfile(userId);
  const next = {
    userId,
    styleVibes: JSON.stringify(patch.styleVibes ?? existing.styleVibes ?? []),
    fitPreference: patch.fitPreference === undefined ? existing.fitPreference : patch.fitPreference,
    comfortFashion: clampComfortFashion(patch.comfortFashion ?? existing.comfortFashion),
    colorsLove: JSON.stringify(patch.colorsLove ?? existing.colorsLove ?? []),
    colorsAvoid: JSON.stringify(patch.colorsAvoid ?? existing.colorsAvoid ?? []),
    climate: patch.climate === undefined ? existing.climate : patch.climate,
    budgetSensitivity: patch.budgetSensitivity === undefined ? existing.budgetSensitivity : patch.budgetSensitivity,
    updatedAt: new Date(),
  };

  await db
    .insert(user_style_profile)
    .values(next)
    .onConflictDoUpdate({
      target: user_style_profile.userId,
      set: {
        styleVibes: next.styleVibes,
        fitPreference: next.fitPreference,
        comfortFashion: next.comfortFashion,
        colorsLove: next.colorsLove,
        colorsAvoid: next.colorsAvoid,
        climate: next.climate,
        budgetSensitivity: next.budgetSensitivity,
        updatedAt: next.updatedAt,
      },
    });

  return getStyleProfile(userId);
}

export async function recordOutfitFeedback(userId: string, outfitId: string, rating: number, reasons: string[] = [], note?: string) {
  const sanitizedReasons = reasons.filter((r) => typeof r === "string" && r.trim().length > 0).slice(0, 8);
  const normalizedRating = Math.max(1, Math.min(5, Math.round(rating)));

  await db.insert(ratings).values({
    id: crypto.randomUUID(),
    userId,
    outfitId,
    rating: normalizedRating,
    reasons: JSON.stringify(sanitizedReasons),
    note: typeof note === "string" && note.trim().length > 0 ? note.trim().slice(0, 400) : null,
    createdAt: new Date(),
  });

  return { ok: true };
}

export async function recordOutfitFeedbackLegacySafe(userId: string, outfitId: string, rating: number, reasons: string[] = [], note?: string) {
  try {
    return await recordOutfitFeedback(userId, outfitId, rating, reasons, note);
  } catch (error) {
    if (!isPersonalizationSchemaError(error)) throw error;

    const normalizedRating = Math.max(1, Math.min(5, Math.round(rating)));
    await db.$client.execute({
      sql: "INSERT INTO ratings (id, outfitId, rating, userId, createdAt) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), outfitId, normalizedRating, userId, Date.now()],
    });

    return { ok: true, legacyFallback: true };
  }
}

export async function computeBias(userId: string): Promise<FeedbackBias> {
  const rows = await db
    .select({ rating: ratings.rating, reasons: ratings.reasons })
    .from(ratings)
    .where(and(eq(ratings.userId, userId), sql`${ratings.reasons} IS NOT NULL`))
    .orderBy(desc(ratings.createdAt))
    .limit(MAX_FEEDBACK_ROWS);

  if (rows.length === 0) {
    return { formalityBias: 0, avoidColorsCount: 0, recentFeedbackCount: 0, avgRating: 0 };
  }

  let sum = 0;
  let formalDelta = 0;
  let avoidColor = 0;

  for (const row of rows) {
    sum += Number(row.rating || 0);
    const parsedReasons = asStringArray(row.reasons, []);
    if (parsedReasons.includes("too-formal")) formalDelta -= 1;
    if (parsedReasons.includes("too-casual")) formalDelta += 1;
    if (parsedReasons.includes("color-clash") || parsedReasons.includes("dislike-color")) avoidColor += 1;
  }

  return {
    formalityBias: Math.max(-3, Math.min(3, formalDelta)),
    avoidColorsCount: avoidColor,
    recentFeedbackCount: rows.length,
    avgRating: Number((sum / rows.length).toFixed(2)),
  };
}

export function buildProfileSummary(
  profile: Awaited<ReturnType<typeof getStyleProfile>>,
  bias: Awaited<ReturnType<typeof computeBias>>,
) {
  const vibes = profile.styleVibes.length ? profile.styleVibes.join(",") : "none";
  const love = profile.colorsLove.length ? profile.colorsLove.join(",") : "none";
  const avoid = profile.colorsAvoid.length ? profile.colorsAvoid.join(",") : "none";
  const fit = profile.fitPreference || "unspecified";
  return `vibes=${vibes};fit=${fit};comfort=${profile.comfortFashion};love=${love};avoid=${avoid};formalityBias=${bias.formalityBias};feedbackCount=${bias.recentFeedbackCount}`;
}
