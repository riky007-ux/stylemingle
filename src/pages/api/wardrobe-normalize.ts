import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";

import { verifyBlobTokenPayload } from "@/lib/verify-blob-token";
import { shouldAttemptNormalization } from "@/lib/wardrobe-blob-upload-handler";

export const config = {
  runtime: "nodejs",
};

type NormalizeRequestBody = {
  tokenPayload?: string;
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

  console.log("Normalize body keys:", Object.keys(req.body || {}));
  console.log("Normalize tokenPayload present:", !!req.body?.tokenPayload);

  const body = (req.body ?? {}) as NormalizeRequestBody & {
    payload?: {
      tokenPayload?: string;
    };
  };
  const blob = body.blob;
  const tokenPayload = body.tokenPayload ?? body.payload?.tokenPayload ?? null;

  if (!tokenPayload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let userId: string;
  try {
    const verified = verifyBlobTokenPayload(tokenPayload);
    userId = verified.userId;
  } catch (err) {
    console.error("Normalize token verification failed:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

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
