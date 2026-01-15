export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";

// Infer MIME type for files that may not provide one (e.g., iPhone camera uploads)
function getMime(file: File): string {
  let mime: string = (file as any).type || "";
  if (!mime || mime === "application/octet-stream") {
    const name = (file as any).name || "";
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "heic" || ext === "heif") return "image/heic";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    // default fallback
    return "image/jpeg";
  }
  return mime;
}

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromAuthHeader(req.headers);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    // Validate that a file with an arrayBuffer method was provided
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const typedFile = file as File;
    const mime = getMime(typedFile);
    // Only allow image MIME types
    if (!mime.startsWith("image/")) {
      return NextResponse.json({ error: "invalid file type" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (typedFile.size > maxSize) {
      return NextResponse.json({ error: "file too large" }, { status: 400 });
    }

    // Create a unique filename, preserving a sanitized portion of the original name and extension
    const ext = mime.split("/")[1] || "jpg";
    const originalName = (typedFile as any).name || "";
    const sanitizedNamePart = originalName.split(".")[0] || "upload";
    const fileName = `${crypto.randomUUID()}-${sanitizedNamePart}.${ext}`;

    // Upload to Vercel Blob with explicit content type
    const blob = await put(fileName, typedFile, {
      access: "public",
      contentType: mime,
    });
    const imageUrl = blob.url;

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
    // Return a descriptive error message when available
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
