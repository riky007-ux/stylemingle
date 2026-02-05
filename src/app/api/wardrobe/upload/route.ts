export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  getUserIdFromAuthHeader,
  verifyToken,
} from "@/lib/auth";

function normalizeToken(raw: string) {
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}

function getUserId(req: NextRequest): string | null {
  const fromHeader = getUserIdFromAuthHeader(req.headers);
  if (fromHeader) return fromHeader;

  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (!cookie?.value) return null;

  return verifyToken(normalizeToken(cookie.value));
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
        { success: false, error: "Image too large. Please choose a photo under 10 MB." },
        { status: 413 }
      );
    }

    const ext = file.type?.includes("/")
      ? file.type.split("/")[1]
      : "jpg";

    const filename = `${crypto.randomUUID()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });

    const id = crypto.randomUUID();
    const createdAt = new Date();

    // ✅ Correct for LibSQL + your schema (camelCase columns)
    await db.run(sql`
      insert into wardrobe_items ("id", "userId", "imageUrl", "createdAt")
      values (${id}, ${userId}, ${blob.url}, ${createdAt})
    `);

    return NextResponse.json(
      { success: true, id, imageUrl: blob.url },
      { status: 200 }
    );
  } catch (err) {
    console.error("UPLOAD_DB_ERROR", err);
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 }
    );
  }
}
