import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import DevPremiumForm from "./DevPremiumForm";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

function isPageEnabled() {
  return process.env.VERCEL_ENV !== "production" || process.env.ALLOW_DEV_PREMIUM_ENDPOINT === "true";
}

function getAllowlist() {
  return String(process.env.PREMIUM_DEV_ALLOWLIST_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export default async function DevPremiumPage() {
  if (!isPageEnabled()) {
    notFound();
  }

  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const userId = token ? verifyToken(token) : null;

  if (!userId) {
    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Dev Premium Toggle</h1>
        <p className="text-zinc-600">Please log in to access this page.</p>
        <Link href="/login" className="mt-3 inline-block underline">
          Go to login
        </Link>
      </div>
    );
  }

  const me = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const currentEmail = String(me[0]?.email || "");

  const allowlist = getAllowlist();
  if (allowlist.length > 0 && (!currentEmail || !allowlist.includes(currentEmail.toLowerCase()))) {
    notFound();
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto" data-testid="dev-premium-page">
      <h1 className="text-3xl font-semibold mb-2">Dev Premium Toggle</h1>
      <p className="text-zinc-600 mb-6">Enable/disable premium for a test account without DevTools.</p>
      <DevPremiumForm initialEmail={currentEmail} />
    </div>
  );
}
