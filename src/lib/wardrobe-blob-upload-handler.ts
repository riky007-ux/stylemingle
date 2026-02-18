import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server.js";

import { signToken } from "@/lib/auth";
import { verifyBlobTokenPayload } from "@/lib/verify-blob-token";

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function getFileExtension(pathname: string) {
  const match = pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function shouldAttemptNormalization(contentType: string | undefined, pathname: string) {
  const normalizedContentType = contentType?.toLowerCase();
  if (normalizedContentType && SUPPORTED_IMAGE_MIME_TYPES.has(normalizedContentType)) {
    return true;
  }

  const extension = getFileExtension(pathname);
  return ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension);
}


type UploadBody = HandleUploadBody & {
  type?: string;
  blob?: {
    url: string;
    pathname: string;
    contentType?: string;
  };
  tokenPayload?: string;
  payload?: {
    blob?: {
      url: string;
      pathname: string;
      contentType?: string;
    };
    tokenPayload?: string;
  };
};

function isUploadCompletedEvent(eventType: unknown): boolean {
  return eventType === "blob.upload-completed" || eventType === "blob.upload.completed";
}

function normalizeUploadBody(body: UploadBody): UploadBody {
  if (body?.payload?.blob) {
    return body;
  }

  if (body?.blob) {
    return {
      type: "blob.upload-completed",
      payload: {
        blob: body.blob,
        tokenPayload: body.tokenPayload,
      },
    } as UploadBody;
  }

  return body;
}

type CookieStore = {
  get(name: string): { value: string } | undefined;
};

type RouteDependencies = {
  authCookieName: string;
  getCookieStore: () => CookieStore;
  verifyToken: (token: string) => string | null;
  handleUploadImpl?: typeof handleUpload;
  fetchImpl?: typeof fetch;
};

export function createWardrobeBlobPostHandler(deps: RouteDependencies) {
  const handleUploadImpl = deps.handleUploadImpl ?? handleUpload;
  const fetchImpl = deps.fetchImpl ?? fetch;

  return async function POST(request: Request) {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const normalizedBody = normalizeUploadBody(body);
    const eventType = normalizedBody?.type;
    body = normalizedBody;

    let userId: string | null = null;
    if (isUploadCompletedEvent(eventType)) {
      const tokenPayload = normalizedBody?.payload?.tokenPayload ?? null;
      if (!tokenPayload) {
        console.error("Missing tokenPayload before normalize call");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      try {
        const verified = verifyBlobTokenPayload(tokenPayload);
        userId = verified.userId;
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const token = deps.getCookieStore().get(deps.authCookieName)?.value;
      if (!token) {
        console.warn("wardrobe/blob unauthorized");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      userId = deps.verifyToken(token);
      if (!userId) {
        console.warn("wardrobe/blob unauthorized");
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    if (body && !body.payload) {
      if ((body as any).pathname !== undefined) {
        body = {
          type: body.type ?? "blob.generate-client-token",
          payload: {
            pathname: (body as any).pathname,
            clientPayload: (body as any).clientPayload ?? "",
            multipart: (body as any).multipart ?? false,
          },
        };
      }

      if (isUploadCompletedEvent(body.type) && (body as any).blob !== undefined) {
        body = {
          type: "blob.upload-completed",
          payload: {
            blob: (body as any).blob,
            tokenPayload: (body as any).tokenPayload,
          },
        };
      }
    }

    const uploadHandlerArgs = {
      request,
      body,
      onBeforeGenerateToken: async () => {
        if (!userId) {
          throw new Error("Unauthorized");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
          ],
          tokenPayload: signToken(userId),
        };
      },
      onUploadCompleted: async ({ blob }: { blob: { url: string; pathname: string; contentType?: string } }) => {
        if (!shouldAttemptNormalization(blob.contentType, blob.pathname)) {
          return;
        }

        try {
          const hostHeader = request.headers.get("host");
          const host = hostHeader ?? new URL(request.url).host;
          const protocol = request.headers.get("x-forwarded-proto") ?? "https";
          const baseUrl = `${protocol}://${host}`;
          const tokenPayload = body?.payload?.tokenPayload ?? null;

          if (!tokenPayload) {
            console.error("Missing tokenPayload before normalize call");
            throw new Error("Missing tokenPayload");
          }

          const normalizeResponse = await fetchImpl(`${baseUrl}/api/wardrobe-normalize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ blob, tokenPayload }),
          });

          if (!normalizeResponse.ok) {
            throw new Error(`Normalization route failed: ${normalizeResponse.status}`);
          }
        } catch (error) {
          console.error("wardrobe/blob normalization failed", error);
        }
      },
    };

    if (isUploadCompletedEvent(eventType)) {
      try {
        const result = await handleUploadImpl(uploadHandlerArgs);
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await handleUploadImpl(uploadHandlerArgs);
    return NextResponse.json(result);
  };
}
