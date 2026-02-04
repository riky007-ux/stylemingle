import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getCookieOptions } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Clear cookie using consistent options + maxAge 0
  res.cookies.set(AUTH_COOKIE_NAME, "", { ...getCookieOptions(), maxAge: 0 });
  return res;
}
