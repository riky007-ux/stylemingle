import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ratings } from "@/lib/schema";

export async function POST(req: Request) {
  try {
    const { outfitId, rating, userId } = await req.json();

    if (!outfitId || rating == null || !userId) {
      return NextResponse.json(
        { error: "outfitId, rating, and userId are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    const result = await db
      .insert(ratings)
      .values({
        id,
        outfitId,
        rating,
        userId,
        createdAt: Date.now(),
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save rating" },
      { status: 500 }
    );
  }
}
