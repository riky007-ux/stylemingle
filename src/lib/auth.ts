import jwt from "jsonwebtoken";

const SECRET = process.env.NEXTAUTH_SECRET || "secret";

export function getUserIdFromAuthHeader(headers: Headers): string | null {
  const auth =
    headers.get("authorization") || headers.get("Authorization");

  if (!auth) return null;

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    return decoded.userId as string;
  } catch {
    return null;
  }
}
