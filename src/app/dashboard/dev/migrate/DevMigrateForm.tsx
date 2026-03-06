"use client";

import { useState } from "react";

type Gate12State = {
  hasIsPremium?: boolean;
  detectedPremiumColumnName?: string | null;
  hasStyleProfileTable?: boolean;
  hasFeedbackTable?: boolean;
  hasFeedbackColumns?: boolean;
  tables?: string[];
};

type MigrateResponse = {
  ok?: boolean;
  gate12Ready?: boolean;
  blockingReasons?: string[];
  warnings?: string[];
  migrationErrorSummary?: string | null;
  forcedPremiumSchemaPatchApplied?: boolean;
  forcedStyleProfileSchemaPatchApplied?: boolean;
  forcedFeedbackSchemaPatchApplied?: boolean;
  before?: Gate12State;
  after?: Gate12State;
  buildInfo?: { commitSha?: string | null };
  code?: string;
  message?: string;
};

export default function DevMigrateForm() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [payloadText, setPayloadText] = useState("");

  const runMigrations = async () => {
    setLoading(true);
    setStatus("");
    setError("");
    setPayloadText("");

    const res = await fetch("/api/dev/migrate", {
      method: "POST",
      headers: {
        "x-stylemingle-admin-token": token,
      },
    });

    const payload: MigrateResponse | null = await res.json().catch(() => null);
    setPayloadText(JSON.stringify({ httpStatus: res.status, ...payload }, null, 2));

    if (!res.ok) {
      setError(`HTTP ${res.status} • ${payload?.code || "UNKNOWN"} • ${payload?.message || "Request failed"}`);
      setLoading(false);
      return;
    }

    setStatus(
      `gate12Ready=${String(Boolean(payload?.gate12Ready))} • blockingReasons=${JSON.stringify(payload?.blockingReasons || [])} • warnings=${JSON.stringify(payload?.warnings || [])} • migrationErrorSummary=${String(payload?.migrationErrorSummary ?? "null")} • after.hasIsPremium=${String(payload?.after?.hasIsPremium)} • after.hasStyleProfileTable=${String(payload?.after?.hasStyleProfileTable)} • after.hasFeedbackColumns=${String(payload?.after?.hasFeedbackColumns)} • commitSha=${String(payload?.buildInfo?.commitSha || "null")}`,
    );
    setLoading(false);
  };

  return (
    <div className="max-w-3xl rounded-2xl border bg-white p-5" data-testid="dev-migrate-form">
      <h2 className="text-xl font-semibold mb-2">Dev Migration Runner</h2>
      <p className="text-sm text-zinc-600 mb-4">Run database migrations for preview testing.</p>

      <div className="space-y-3">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="PREMIUM_ADMIN_TOKEN"
          className="w-full border rounded p-2"
        />

        <button onClick={runMigrations} disabled={loading} className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60">
          {loading ? "Running…" : "Run migrations"}
        </button>

        {status && <p className="text-sm text-emerald-700">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {payloadText && (
          <pre className="max-h-96 overflow-auto rounded bg-zinc-100 p-3 text-xs" data-testid="migrate-canonical-output">
            {payloadText}
          </pre>
        )}
      </div>
    </div>
  );
}
