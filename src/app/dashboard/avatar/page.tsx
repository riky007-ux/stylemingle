import { Suspense } from "react";
import AvatarClient from "./AvatarClient";

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
  return (
    <Suspense fallback={<AvatarLoadingFallback />}>
      <AvatarClient />
    </Suspense>
  );
}
