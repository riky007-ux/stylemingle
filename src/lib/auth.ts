import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "auth";

const SECRET = process.env.NEXTAUTH_SECRET || "";

// NOTE: This throws at module import time if NEXTAUTH_SECRET isn't set.
// That is expected in environments where auth routes are used without env,
// but for local builds you must set NEXTAUTH_SECRET in .env.local.
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
 * Cookie-based auth (used by browser + curl cookie-jar flows).
 * Reads the JWT from the `auth` cookie and verifies it.
 */
export function getUserIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]+)`)
  );
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  return verifyToken(token);
}
