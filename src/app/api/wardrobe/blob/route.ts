export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { AUTH_COOKIE_NAME, getUserIdFromAuthHeader, verifyToken } from "@/lib/auth";

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
  return handleUpload({
    request: req,
    onBeforeGenerateToken: async () => {
      const userId = getUserId(req);
      if (!userId) {
        throw new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      return {
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
        ],
        maximumSizeInBytes: 25 * 1024 * 1024,
        tokenPayload: JSON.stringify({ userId }),
      };
    },
  });
}
