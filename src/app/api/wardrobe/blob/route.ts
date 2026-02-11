import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { createWardrobeBlobPostHandler } from "@/lib/wardrobe-blob-upload-handler";

export const runtime = "nodejs";

export const POST = createWardrobeBlobPostHandler({
  authCookieName: AUTH_COOKIE_NAME,
  getCookieStore: () => cookies(),
  verifyToken,
});
