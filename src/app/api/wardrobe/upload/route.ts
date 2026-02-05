export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import {
  AUTH_COOKIE_NAME,
  getUserIdFromAuthHeader,
  verifyToken,
} from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";
import sharp from "sharp";

function normalizeToken(raw: string) {
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}

function getUserId(req: NextRequest): string | null {
  // 1) Authorization header (preferred)
  const fromHeader = getUserIdFromAuthHeader(req.headers);
  if (fromHeader) return fromHeader;

  // 2) Cookie fallback
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (!cookie?.value) return null;

  return verifyToken(normalizeToken(cookie.value));
}

export async function POST(req: NextRequest) {
  // --- AUTH ---
  let userId: string | null = null;
  try {
    userId = getUserId(req);
  } catch (err) {
    console.error("UPLOAD auth parse failed", err);
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
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

    // Determine file type + optional HEIC conversion
    const originalName = (file.name || "").toLowerCase();
    const extFromName = originalName.split(".").pop() || "";
    let contentType = file.type || "";
    let uploadData: any = file;
    let filename: string;

    const isHeic =
      (!contentType && (extFromName === "heic" || extFromName === "heif")) ||
      contentType === "image/heic" ||
      contentType === "image/heif";

    if (isHeic) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const jpegBuffer = await sharp(buffer).jpeg().toBuffer();
        uploadData = jpegBuffer;
        contentType = "image/jpeg";
        filename = `${crypto.randomUUID()}.jpg`;
      } catch (err) {
        console.error("UPLOAD HEIC conversion failed", err);
        return NextResponse.json(
          {
            success: false,
            error:
              "HEIC upload failed to convert. Please upload JPG/PNG or try a different photo.",
          },
          { status: 415 }
        );
      }
    } else {
      const ext =
        contentType && contentType.includes("/")
          ? contentType.split("/")[1]
          : extFromName || "jpg";
      filename = `${crypto.randomUUID()}.${ext}`;
    }

    // Upload to Vercel Blob
    const blob = await put(filename, uploadData, {
      access: "public",
      contentType: contentType || "application/octet-stream",
    });

    // DB insert: match Drizzle schema
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

    // Return a superset to avoid frontend breakage
    return NextResponse.json(
      { success: true, id, imageUrl: blob.url, url: blob.url },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("UPLOAD error", err);

    const status = err?.status || err?.statusCode;
    if (status === 403) {
      return NextResponse.json(
        { success: false, error: "Upload forbidden. Please log in again." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
