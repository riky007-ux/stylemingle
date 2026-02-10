import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

export async function POST(request: Request) {
  // Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = body?.type;

  // `blob.upload-completed` callbacks can be sent from Blob infra without browser cookies.
  // Keep cookie auth strict for client token generation requests.
  let userId: string | null = null;
  if (eventType !== "blob.upload-completed") {
    const token = cookies().get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      console.warn("wardrobe/blob unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = verifyToken(token);
    if (!userId) {
      console.warn("wardrobe/blob unauthorized");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  // ✅ Normalize to the envelope Vercel Blob expects:
  // { type, payload: { pathname, clientPayload, multipart } }
  if (body && !body.payload) {
    // If caller sent flat fields, wrap them
    if (body.pathname !== undefined) {
      body = {
        type: body.type ?? "blob.generate-client-token",
        payload: {
          pathname: body.pathname,
          clientPayload: body.clientPayload ?? "",
          multipart: body.multipart ?? false,
        },
      };
    }

    // If caller sent upload-completed in a flat shape, wrap that too
    if (body.type === "blob.upload-completed" && body.blob !== undefined) {
      body = {
        type: body.type,
        payload: {
          blob: body.blob,
          tokenPayload: body.tokenPayload,
        },
      };
    }
  }

  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (_pathname, _clientPayload, _multipart) => {
      if (!userId) {
        throw new Error("Unauthorized");
      }

      return {
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
        tokenPayload: JSON.stringify({ userId }),
      };
    },
    onUploadCompleted: async () => {
      // no-op: DB insert happens client-side via /api/wardrobe/items
    },
  });

  return NextResponse.json(result);
}
