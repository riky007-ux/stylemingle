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

    // Generate unique filename
    const fileName = crypto.randomUUID();

    // Upload to storage
    const blob = await put(fileName, file, {
      access: "public",
    });
    const imageUrl = blob.url;

    // Insert record into database with explicit values
    const id = crypto.randomUUID();
    const createdAt = new Date();
    await db.insert(wardrobe_items).values({
      id,
      userId,
      imageUrl,
      category: "unknown",
      color: "unknown",
      style: "unknown",
      season: "unknown",
      notes: null,
      createdAt,
    });

    return NextResponse.json(
      { success: true, imageUrl, id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("UPLOAD_ERROR", error);
    return NextResponse.json(
      { error: "Failed to upload" },
      { status: 500 }
    );
  }
}
