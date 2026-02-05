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
