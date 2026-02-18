import jwt from "jsonwebtoken";

type VerifiedBlobTokenPayload = {
  userId: string;
};

export function verifyBlobTokenPayload(tokenPayload: string): VerifiedBlobTokenPayload {
  if (!tokenPayload) {
    throw new Error("Missing tokenPayload");
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET");
  }

  const decoded = jwt.verify(tokenPayload, secret) as { userId?: string };
  if (!decoded?.userId) {
    throw new Error("Invalid token payload");
  }

  return { userId: decoded.userId };
}
