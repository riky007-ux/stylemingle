import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server.js";

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

function shouldIncludePreviewBypass(normalizeUrl: URL, requestUrl: string, bypassSecret: string) {
  if (process.env.VERCEL_ENV !== "preview") {
    return false;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (!vercelUrl) {
    return false;
  }

  try {
    const previewOrigin = `https://${vercelUrl}`;
    const requestOrigin = new URL(requestUrl).origin;

    return (
      Boolean(bypassSecret) &&
      normalizeUrl.origin === previewOrigin &&
      requestOrigin === previewOrigin
    );
  } catch {
    return false;
  }
}

function buildNormalizeHeaders(normalizeUrl: URL, requestUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassSecret && shouldIncludePreviewBypass(normalizeUrl, requestUrl, bypassSecret)) {
    headers["x-vercel-protection-bypass"] = bypassSecret;
  }

  return headers;
}

function signWardrobeNormalizeToken(userId: string, pathname: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET");
  }

  return jwt.sign(
    {
      purpose: "wardrobe-normalize",
      pathname,
      userId,
    },
    secret,
    { expiresIn: "15m" },
  );
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
  tokenPayload?: string;
  payload?: {
    blob?: {
      url: string;
      pathname: string;
      contentType?: string;
    };
    pathname?: string;
    tokenPayload?: string;
  };
};

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
    let body: UploadBody;
    try {
      body = (await request.json()) as UploadBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const eventType = body?.type;

    let userId: string | null = null;
    if (eventType !== "blob.upload-completed") {
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
        } as UploadBody;
      }

      if (body.type === "blob.upload-completed" && (body as any).blob !== undefined) {
        body = {
          type: body.type,
          payload: {
            blob: (body as any).blob,
            tokenPayload: (body as any).tokenPayload,
          },
        } as UploadBody;
      }
    }

    const uploadHandlerArgs = {
      request,
      body,
      onBeforeGenerateToken: async () => {
        if (!userId) {
          throw new Error("Unauthorized");
        }

        const pathname = body?.payload?.pathname;
        if (!pathname) {
          throw new Error("Missing pathname");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
          ],
          tokenPayload: signWardrobeNormalizeToken(userId, pathname),
        };
      },
      onUploadCompleted: async ({ blob }: { blob: { url: string; pathname: string; contentType?: string } }) => {
        if (!shouldAttemptNormalization(blob.contentType, blob.pathname)) {
          return;
        }

        try {
          const origin = new URL(request.url).origin;
          const normalizeUrl = new URL("/api/wardrobe-normalize", origin);
          const tokenPayload = body?.payload?.tokenPayload ?? body?.tokenPayload ?? null;

          if (!tokenPayload) {
            console.error("Missing tokenPayload before normalize call");
            return;
          }

          const normalizeResponse = await fetchImpl(normalizeUrl, {
            method: "POST",
            headers: buildNormalizeHeaders(normalizeUrl, request.url),
            body: JSON.stringify({
              eventType: body?.type ?? "blob.upload-completed",
              blob,
              tokenPayload,
            }),
          });

          if (!normalizeResponse.ok) {
            const responseContentType = normalizeResponse.headers.get("content-type") ?? "";
            const htmlPreview = responseContentType.includes("text/html")
              ? (await normalizeResponse.text()).slice(0, 80)
              : undefined;

            console.error("Normalization route failed", {
              status: normalizeResponse.status,
              contentType: responseContentType,
              htmlPreview,
            });

            throw new Error(`Normalization route failed: ${normalizeResponse.status}`);
          }
        } catch (error) {
          console.error("wardrobe/blob normalization failed", error);
        }
      },
    };

    if (eventType === "blob.upload-completed") {
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
