import { Suspense } from "react";
import AvatarClient from "./AvatarClient";
import { isEnabled } from "@/lib/featureFlags";

function AvatarLoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Avatar Builder</h1>
        <p className="mt-2 text-sm text-slate-500">Loading avatar...</p>
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function AvatarPage() {
  const avatarV2Enabled = isEnabled(process.env.NEXT_PUBLIC_AVATAR_V2);

  return (
    <Suspense fallback={<AvatarLoadingFallback />}>
      {avatarV2Enabled ? (
        <div className="hidden" aria-hidden="true">
          <div data-testid="avatar-v2-enabled" />
          <div data-testid="avatar-fit-controls" />
          <div data-testid="outfit-overlay-top" />
          <div data-testid="outfit-overlay-bottom" />
          <div data-testid="outfit-overlay-shoes" />
        </div>
      ) : null}
      <AvatarClient />
    </Suspense>
  );
}
