import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";
import jwt from "jsonwebtoken";
import sharp from "sharp";

import { decodeHeicToRgba } from "@/lib/decode-heic-to-rgba";
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

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

type WardrobeNormalizeTokenClaims = {
  purpose: "wardrobe-normalize";
  pathname: string;
  userId: string;
};

function verifyWardrobeNormalizeToken(token: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as Partial<WardrobeNormalizeTokenClaims>;
    if (
      decoded.purpose !== "wardrobe-normalize" ||
      typeof decoded.pathname !== "string" ||
      typeof decoded.userId !== "string"
    ) {
      return null;
    }

    return decoded as WardrobeNormalizeTokenClaims;
  } catch {
    return null;
  }
}

function hasHeifSignature(buffer: Buffer) {
  if (buffer.length < 12) {
    return false;
  }

  const boxType = buffer.toString("ascii", 4, 8);
  if (boxType !== "ftyp") {
    return false;
  }

  const majorBrand = buffer.toString("ascii", 8, 12);
  if (HEIF_BRANDS.has(majorBrand)) {
    return true;
  }

  for (let index = 16; index + 4 <= buffer.length; index += 4) {
    const compatibleBrand = buffer.toString("ascii", index, index + 4);
    if (HEIF_BRANDS.has(compatibleBrand)) {
      return true;
    }
  }

  return false;
}

function jpegMagicHex(buf: Buffer) {
  if (!buf || buf.length < 3) {
    return "too-short";
  }

  return buf.subarray(0, 3).toString("hex");
}

function assertIsJpeg(buf: Buffer, label: string) {
  const hex = jpegMagicHex(buf);
  if (hex !== "ffd8ff") {
    throw new Error(`${label} is not JPEG: magic=${hex}`);
  }
}

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

  if (typeof tokenPayload !== "string") {
    console.warn("normalize auth failed: invalid token or pathname mismatch", {
      pathname: blob.pathname,
    });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const claims = verifyWardrobeNormalizeToken(tokenPayload);
  if (!claims || claims.pathname !== blob.pathname) {
    console.warn("normalize auth failed: invalid token or pathname mismatch", {
      pathname: blob.pathname,
    });
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!shouldAttemptNormalization(blob.contentType, blob.pathname)) {
    return res.status(200).json({ skipped: true });
  }

  try {
    const extension = blob.pathname.toLowerCase();
    const callbackContentType = blob.contentType?.toLowerCase() ?? "";

    const downloadedArrayBuffer = await fetch(blob.url).then((response) => response.arrayBuffer());
    const inputBuffer = Buffer.from(downloadedArrayBuffer);

    const metadataIndicatesJpeg =
      extension.endsWith(".jpg") ||
      extension.endsWith(".jpeg") ||
      callbackContentType === "image/jpeg" ||
      callbackContentType === "image/jpg";

    const metadataIndicatesHeic =
      extension.endsWith(".heic") ||
      extension.endsWith(".heif") ||
      callbackContentType === "image/heic" ||
      callbackContentType === "image/heif";

    const signatureIndicatesHeif = hasHeifSignature(inputBuffer);
    const isHeic = metadataIndicatesHeic || signatureIndicatesHeif;

    if (signatureIndicatesHeif && metadataIndicatesJpeg) {
      console.warn("HEIC signature mismatch: pathname/contentType indicated jpeg", {
        pathname: blob.pathname,
        contentType: blob.contentType,
      });
    }

    let outputJpeg: Buffer;

    if (isHeic) {
      const { data, width, height } = await decodeHeicToRgba(inputBuffer);

      outputJpeg = await sharp(data, {
        raw: { width, height, channels: 4 },
      })
        .jpeg({ quality: 90 })
        .toBuffer();

      assertIsJpeg(outputJpeg, "normalize outputJpeg");

      const written = await put(blob.pathname, outputJpeg, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
      });

      console.log("normalize heic write", {
        pathname: blob.pathname,
        inputMagic: jpegMagicHex(inputBuffer),
        outputMagic: jpegMagicHex(outputJpeg),
        beforeUrl: blob.url,
        afterUrl: written.url,
      });

      if (written.url !== blob.url) {
        console.warn("normalize heic write url changed", {
          pathname: blob.pathname,
          beforeUrl: blob.url,
          afterUrl: written.url,
        });
      }

      const verifyRes = await fetch(written.url, {
        headers: {
          Range: "bytes=0-2",
          "cache-control": "no-cache",
        },
      });
      const verifyBuf = Buffer.from(await verifyRes.arrayBuffer());
      console.log("normalize post-put verify", {
        status: verifyRes.status,
        magic: jpegMagicHex(verifyBuf),
      });

      return res.status(200).json({ ok: true, converted: "heic-wasm" });
    }

    outputJpeg = await sharp(inputBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    assertIsJpeg(outputJpeg, "normalize outputJpeg");

    await put(blob.pathname, outputJpeg, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg",
    });

    return res.status(200).json({ ok: true, converted: "sharp" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("wardrobe/blob normalization failed", {
      pathname: blob.pathname,
      contentType: blob.contentType,
      message,
    });

    if (message.includes("HEIC")) {
      return res.status(422).json({ error: "HEIC decode failed (wasm)" });
    }

    return res.status(500).json({ error: "Normalization failed" });
  }
}
