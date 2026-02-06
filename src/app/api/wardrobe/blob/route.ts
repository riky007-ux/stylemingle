import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

export async function POST(request: Request) {
  // 🔐 Auth check (cookie-based, aligned with repo)
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = verifyToken(token);

  if (!userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // ✅ IMPORTANT: this handleUpload signature requires body + request
  const body = await request.json();

  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (_pathname, _clientPayload, _multipart) => {
      return {
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
        ],
        // tokenPayload MUST be a string
        tokenPayload: JSON.stringify({ userId }),
      };
    },
    onUploadCompleted: async () => {
      // no-op: DB insert happens client-side via /api/wardrobe/items
    },
  });

  // ✅ App Router requires a Response
  return NextResponse.json(result);
}
