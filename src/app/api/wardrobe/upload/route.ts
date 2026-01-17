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
    console.log("UPLOAD: start");

    // --- AUTH (never throw) ---
    let userId: string | null = null;
    try {
      userId = getUserIdFromAuthHeader(req.headers);
    } catch (err) {
      console.error("UPLOAD: auth parse failed", err);
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

    // --- FORM DATA ---
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error("UPLOAD: formData parse failed", err);
      return NextResponse.json(
        { success: false, error: "Invalid form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "File missing" },
        { status: 400 }
      );
    }

    // --- BLOB UPLOAD ---
    const filename = crypto.randomUUID();
    let blob;
    try {
      blob = await put(filename, file, {
        access: "public",
        contentType: file.type || "application/octet-stream",
      });
    } catch (err) {
      console.error("UPLOAD: blob upload failed", err);
      return NextResponse.json(
        { success: false, error: "Upload failed" },
        { status: 500 }
      );
    }

    // --- DB INSERT (explicit, unbreakable) ---
    const id = crypto.randomUUID();
    const createdAt = new Date();

    try {
      await db.insert(wardrobe_items).values({
        id,
        userId,
        imageUrl: blob.url,
        createdAt,
      }).run();
    } catch (err) {
      console.error("UPLOAD: db insert failed", err);
      return NextResponse.json(
        { success: false, error: "Database insert failed" },
        { status: 400 }
      );
    }

    console.log("UPLOAD: success");

    // --- SAFE RESPONSE ---
    return NextResponse.json({
      success: true,
      id,
      imageUrl: blob.url,
    });
  } catch (err) {
    console.error("UPLOAD: fatal error", err);
    return NextResponse.json(
      { success: false, error: "Internal upload error" },
      { status: 500 }
    );
  }
}
