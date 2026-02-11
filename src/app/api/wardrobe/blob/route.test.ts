import assert from "node:assert/strict";
import test from "node:test";

import { createWardrobeBlobPostHandler } from "../../../../lib/wardrobe-blob-upload-handler.ts";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8QDw8QDxAPEA8PDw8PDw8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OFQ8QFS0dFR0rLS0tLS0tLS0rLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tK//AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEAAwAAAAAAAAAAAAAAAAAAAQID/8QAFhABAQEAAAAAAAAAAAAAAAAAAAER/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z",
  "base64",
);

function isJpeg(buffer: Buffer) {
  return buffer.subarray(0, 3).equals(JPEG_MAGIC);
}

test("HEIC upload callback is normalized and overwritten as JPEG", async () => {
  const putCalls: Array<{ pathname: string; contentType?: string; buffer: Buffer }> = [];

  const post = createWardrobeBlobPostHandler({
    authCookieName: "auth",
    getCookieStore: () => ({ get: () => undefined }),
    verifyToken: () => "user-1",
    fetchImpl: async () => new Response(Buffer.from("heic-source"), { status: 200 }),
    normalizeBufferImpl: async () => MINIMAL_JPEG,
    putImpl: (async (pathname, body, options) => {
      putCalls.push({
        pathname,
        contentType: options?.contentType,
        buffer: Buffer.from(body as Uint8Array),
      });
      return { url: "https://blob.example/wardrobe/file.jpg", pathname } as any;
    }) as any,
    handleUploadImpl: (async ({ onUploadCompleted }) => {
      await onUploadCompleted({
        blob: {
          url: "https://blob.example/uploaded.heic",
          pathname: "wardrobe/file.jpg",
          contentType: "image/heic",
        },
      });

      return {
        ok: true,
        token: "same-contract",
      };
    }) as any,
  });

  const response = await post(
    new Request("http://localhost/api/wardrobe/blob", {
      method: "POST",
      body: JSON.stringify({
        type: "blob.upload-completed",
        payload: {
          blob: {
            url: "https://blob.example/uploaded.heic",
            pathname: "wardrobe/file.jpg",
            contentType: "image/heic",
          },
        },
      }),
      headers: { "content-type": "application/json" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, token: "same-contract" });
  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].pathname, "wardrobe/file.jpg");
  assert.equal(putCalls[0].contentType, "image/jpeg");
  assert.equal(isJpeg(putCalls[0].buffer), true);
});

for (const format of ["jpeg", "png", "webp"] as const) {
  test(`${format.toUpperCase()} upload callback is normalized to JPEG`, async () => {
    const putCalls: Array<{ contentType?: string; buffer: Buffer }> = [];

    const post = createWardrobeBlobPostHandler({
    authCookieName: "auth",
    getCookieStore: () => ({ get: () => undefined }),
    verifyToken: () => "user-1",
      fetchImpl: async () => new Response(Buffer.from(`${format}-source`), { status: 200 }),
      normalizeBufferImpl: async () => MINIMAL_JPEG,
      putImpl: (async (_pathname, body, options) => {
        putCalls.push({
          contentType: options?.contentType,
          buffer: Buffer.from(body as Uint8Array),
        });
        return { url: "https://blob.example/wardrobe/file.jpg" } as any;
      }) as any,
      handleUploadImpl: (async ({ onUploadCompleted }) => {
        await onUploadCompleted({
          blob: {
            url: `https://blob.example/uploaded.${format}`,
            pathname: "wardrobe/file.jpg",
            contentType: `image/${format}`,
          },
        });

        return { ok: true };
      }) as any,
    });

    await post(
      new Request("http://localhost/api/wardrobe/blob", {
        method: "POST",
        body: JSON.stringify({ type: "blob.upload-completed", payload: { blob: {} } }),
        headers: { "content-type": "application/json" },
      }),
    );

    assert.equal(putCalls.length, 1);
    assert.equal(putCalls[0].contentType, "image/jpeg");
    assert.equal(isJpeg(putCalls[0].buffer), true);
  });
}
