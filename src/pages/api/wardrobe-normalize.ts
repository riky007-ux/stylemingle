import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";

import { shouldAttemptNormalization } from "@/lib/wardrobe-blob-upload-handler";

export const config = {
  runtime: "nodejs",
};

type NormalizeRequestBody = {
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
  const blob = body.blob;

  if (!blob?.url || !blob.pathname) {
    return res.status(400).json({ error: "Missing blob payload" });
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
