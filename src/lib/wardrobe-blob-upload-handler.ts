import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
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

export function shouldAttemptNormalization(contentType: string | undefined, pathname: string) {
  const normalizedContentType = contentType?.toLowerCase();
  if (normalizedContentType && SUPPORTED_IMAGE_MIME_TYPES.has(normalizedContentType)) {
    return true;
  }

  const extension = getFileExtension(pathname);
  return ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension);
}

async function convertToJpegWithSharp(sourceBuffer: Buffer) {
  const dynamicImport = new Function("moduleName", "return import(moduleName)") as (
    moduleName: string,
  ) => Promise<any>;

  const sharpModule = await dynamicImport("sharp");

  return sharpModule
    .default(sourceBuffer, { failOn: "none" })
    .rotate()
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function normalizeImageBufferToJpeg(sourceBuffer: Buffer) {
  return convertToJpegWithSharp(sourceBuffer);
}

type UploadBody = HandleUploadBody & {
  payload?: {
    blob?: {
      url: string;
      pathname: string;
      contentType?: string;
    };
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
  putImpl?: typeof put;
  fetchImpl?: typeof fetch;
  normalizeBufferImpl?: (buffer: Buffer) => Promise<Buffer>;
};

export function createWardrobeBlobPostHandler(deps: RouteDependencies) {
  const handleUploadImpl = deps.handleUploadImpl ?? handleUpload;
  const putImpl = deps.putImpl ?? put;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const normalizeBufferImpl = deps.normalizeBufferImpl ?? normalizeImageBufferToJpeg;

  return async function POST(request: Request) {
    let body: any;
    try {
      body = await request.json();
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
        };
      }

      if (body.type === "blob.upload-completed" && (body as any).blob !== undefined) {
        body = {
          type: body.type,
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
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async ({ blob }: { blob: { url: string; pathname: string; contentType?: string } }) => {
        if (!shouldAttemptNormalization(blob.contentType, blob.pathname)) {
          return;
        }

        try {
          const sourceResponse = await fetchImpl(blob.url);
          if (!sourceResponse.ok) {
            throw new Error(`Failed to read blob: ${sourceResponse.status}`);
          }

          const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
          const jpegBuffer = await normalizeBufferImpl(sourceBuffer);

          await putImpl(blob.pathname, jpegBuffer, {
            access: "public",
            contentType: "image/jpeg",
            addRandomSuffix: false,
            allowOverwrite: true,
          });
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
