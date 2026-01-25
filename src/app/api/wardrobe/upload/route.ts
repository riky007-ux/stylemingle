export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    // --- AUTH ---
    let userId: string | null = null;
    try {
      // try from Authorization header
      userId = getUserIdFromAuthHeader(req.headers);
      // fallback to cookie "auth" if header missing/invalid
      if (!userId) {
        const cookieHeader = req.headers.get("cookie") || "";
        const authCookiePair = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("auth="));
        if (authCookiePair) {
          const cookieVal = decodeURIComponent(authCookiePair.split("=")[1] || "");
          const headerVal = cookieVal.startsWith("Bearer")
            ? cookieVal
            : `Bearer ${cookieVal}`;
          const fallbackHeaders = new Headers();
          fallbackHeaders.set("Authorization", headerVal);
          userId = getUserIdFromAuthHeader(fallbackHeaders);
        }
      }
    } catch (err) {
      console.error("UPLOAD auth parse failed", err);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- FORM DATA ---
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image too large. Please choose a photo under 10 MB." },
        { status: 413 }
      );
    }

    try {
      // Determine file type and possible HEIC conversion
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
        // convert to JPEG using sharp
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const jpegBuffer = await sharp(buffer).jpeg().toBuffer();
        uploadData = jpegBuffer;
        contentType = "image/jpeg";
        filename = `${crypto.randomUUID()}.jpg`;
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

      return NextResponse.json({ id, imageUrl: blob.url }, { status: 200 });
    } catch (err: any) {
      // handle forbidden errors from blob storage or others
      console.error("UPLOAD put or DB error", err);
      const status = err?.status || err?.statusCode;
      if (status === 403) {
        return NextResponse.json(
          { error: "Upload forbidden. Please log in again." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  } catch (err: any) {
    console.error("UPLOAD server error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
