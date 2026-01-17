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
    // --- AUTH ---
    let userId: string | null = null;
    try {
      userId = getUserIdFromAuthHeader(req.headers);
    } catch (err) {
      console.error("UPLOAD auth parse failed", err);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // --- FORM DATA ---
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Image too large. Please choose a photo under 10 MB.",
        },
        { status: 413 }
      );
    }

    // --- BLOB UPLOAD ---
    const ext =
      file.type && file.type.includes("/")
        ? file.type.split("/")[1]
        : "jpg";

    const filename = `${crypto.randomUUID()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });

    // --- DB INSERT ---
    const id = crypto.randomUUID();
    const createdAt = new Date();

    await db
      .insert(wardrobe_items)
      .values({
        id,
        userId,
        imageUrl: blob.url,
        createdAt,
      })
      .run();

    return NextResponse.json(
      {
        success: true,
        id,
        imageUrl: blob.url,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("UPLOAD server error", err);
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 }
    );
  }
}
