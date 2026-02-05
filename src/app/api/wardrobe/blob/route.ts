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
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // handleUpload returns a Response
  return handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => {
      return {
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
        ],
        maximumSizeInBytes: 25 * 1024 * 1024, // 25MB
        tokenPayload: JSON.stringify({ userId }),
      };
    },
  });
}
