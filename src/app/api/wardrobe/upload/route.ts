export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { getUserIdFromAuthHeader, AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // --- AUTH ---
    let userId: string | null = getUserIdFromAuthHeader(req.headers);
    if (!userId) {
      const cookieValue = req.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (cookieValue) {
        userId = verifyToken(cookieValue);
      }
    }
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
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
    });

    // Save to DB
    await db.insert(wardrobe_items).values({
      name: filename,
      url: blob.url,
      size: file.size,
      user_id: userId,
      type: file.type,
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error("UPLOAD error", err);
    return NextResponse.json(
      { success: false, error: "Upload error" },
      { status: 500 }
    );
  }
}
