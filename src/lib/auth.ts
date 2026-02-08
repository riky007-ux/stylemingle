import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "auth";

const SECRET = process.env.NEXTAUTH_SECRET || "";

if (!SECRET) {
  throw new Error("Missing NEXTAUTH_SECRET");
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    return decoded.userId as string;
  } catch {
    return null;
  }
}

export function getCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.VERCEL_ENV === "production",
  };
}

export function getUserIdFromAuthHeader(headers: Headers): string | null {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (!auth) return null;
  const token = auth.split(" ")[1];
  return verifyToken(token);
}

/**
 * Cookie-based auth for App Router route handlers and browser/curl cookie-jar flows.
 * Works with NextRequest (req.cookies) and generic Request (cookie header).
 */
export function getUserIdFromRequest(req: Request): string | null {
  // NextRequest has a `cookies` accessor; use it when available.
  const anyReq = req as any;
  const cookieStore = anyReq?.cookies;
  if (cookieStore && typeof cookieStore.get === "function") {
    const v = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!v) return null;
    return verifyToken(v);
  }

  // Fallback: parse raw Cookie header.
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]+)`)
  );
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  return verifyToken(token);
}
