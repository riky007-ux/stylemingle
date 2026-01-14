import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromAuthHeader(req.headers);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const typedFile = file as File;
    const mime = typedFile.type || "application/octet-stream";
    if (!mime.startsWith("image/")) {
      return NextResponse.json({ error: "invalid file type" }, { status: 400 });
    }
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (typedFile.size > maxSize) {
      return NextResponse.json({ error: "file too large" }, { status: 400 });
    }

    // Create a unique filename
    const fileName = `${crypto.randomUUID()}-${typedFile.name}`;
    // Upload to Vercel Blob
    const blob = await put(fileName, typedFile, { access: "public" });
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
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
