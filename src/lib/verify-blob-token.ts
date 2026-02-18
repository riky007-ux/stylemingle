import { verifyToken } from "@/lib/auth";

type VerifiedBlobTokenPayload = {
  userId: string;
};

export function verifyBlobTokenPayload(tokenPayload: unknown): VerifiedBlobTokenPayload {
  if (typeof tokenPayload !== "string" || tokenPayload.length === 0) {
    throw new Error("Missing token payload");
  }

  const userId = verifyToken(tokenPayload);
  if (!userId) {
    throw new Error("Invalid token payload");
  }

  return { userId };
}

