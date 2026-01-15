export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    console.log("Starting upload handler");
    const userId = getUserIdFromAuthHeader(req.headers);
    if (!userId) {
      console.log("No user id");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      console.log("File missing");
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    // Generate a unique filename
    const fileName = crypto.randomUUID();

    // Upload to storage
    const blob = await put(fileName, file, {
      access: "public",
    });
    const imageUrl = blob.url;

    // Insert record into database
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const result = await db
      .insert(wardrobe_items)
      .values({
        id,
        userId,
        imageUrl,
        createdAt,
      })
      .returning();

    return NextResponse.json(result[0], { status: 200 });
  } catch (error: any) {
    console.error("UPLOAD_ERROR", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
