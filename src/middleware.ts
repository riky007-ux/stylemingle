import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/wardrobe/upload") {
    const len = Number(req.headers.get("content-length") || "0");
    if (len > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image too large. Please choose a photo under 10 MB." },
        { status: 413 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/wardrobe/upload"],
};
