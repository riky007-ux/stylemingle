import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wardrobe_items } from "@/lib/schema";
import { getUserIdFromAuthHeader } from "@/lib/auth";
import crypto from "crypto";
import { Buffer } from "buffer";

export async function POST(req: Request) {
  const userId = getUserIdFromAuthHeader(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof (file as any).arrayBuffer !== "function") {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const arrayBuffer = await (file as any).arrayBuffer();
  const mime = (file as any).type || "image/jpeg";
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const imageUrl = "data:" + mime + ";base64," + base64;

  const id = crypto.randomUUID();
  const result = await db
    .insert(wardrobe_items)
    .values({
      id,
      userId,
      imageUrl,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json(result[0]);
}
