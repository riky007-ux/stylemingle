import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";

import { shouldAttemptNormalization } from "@/lib/wardrobe-blob-upload-handler";

export const config = {
  runtime: "nodejs",
};

type NormalizeRequestBody = {
  eventType?: string;
  tokenPayload?: string;
  payload?: {
    tokenPayload?: string;
  };
  blob?: {
    url?: string;
    pathname?: string;
    contentType?: string;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as NormalizeRequestBody;
  const eventType = body.eventType;
  const blob = body.blob;
  const tokenPayload = body.tokenPayload ?? body.payload?.tokenPayload ?? null;

  if (eventType !== "blob.upload-completed") {
    return res.status(400).json({ error: "Invalid eventType" });
  }

  if (!tokenPayload) {
    return res.status(400).json({ error: "Missing tokenPayload" });
  }

  if (!blob?.url || !blob.pathname) {
    return res.status(400).json({ error: "Missing blob payload" });
  }

  let blobUrl: URL;
  try {
    blobUrl = new URL(blob.url);
  } catch {
    return res.status(400).json({ error: "Invalid blob url" });
  }

  const allowedBlobHost =
    blobUrl.hostname === "blob.vercel-storage.com" ||
    blobUrl.hostname.endsWith(".blob.vercel-storage.com") ||
    blobUrl.hostname.endsWith(".public.blob.vercel-storage.com");

  if (!allowedBlobHost) {
    return res.status(400).json({ error: "Invalid blob host" });
  }

  if (!blob.pathname.startsWith("wardrobe/")) {
    return res.status(400).json({ error: "Invalid blob pathname" });
  }

  if (!shouldAttemptNormalization(blob.contentType, blob.pathname)) {
    return res.status(200).json({ skipped: true });
  }

  try {
    const sourceResponse = await fetch(blob.url);
    if (!sourceResponse.ok) {
      throw new Error(`Failed to read blob: ${sourceResponse.status}`);
    }

    const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
    const sharpModule = await import("sharp");
    const jpegBuffer = await sharpModule
      .default(sourceBuffer, { failOn: "none" })
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();

    await put(blob.pathname, jpegBuffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("wardrobe/blob normalization failed", error);
    return res.status(500).json({ error: "Normalization failed" });
  }
}
