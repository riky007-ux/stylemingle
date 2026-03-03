"use client";

import { useState } from "react";

type SchemaDiagnostics = {
  columns?: string[];
  hasIsPremium?: boolean;
  detectedPremiumColumnName?: "isPremium" | "is_premium" | null;
};

export default function DevMigrateForm() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [afterSchema, setAfterSchema] = useState<SchemaDiagnostics | null>(null);
  const [diagOutput, setDiagOutput] = useState("");

  const runMigrations = async () => {
    setLoading(true);
    setStatus("");
    setError("");
    setDiagOutput("");

    const res = await fetch("/api/dev/migrate", {
      method: "POST",
      headers: {
        "x-stylemingle-admin-token": token,
      },
    });

    const payload = await res.json().catch(() => null);
    if (res.ok) {
      const applied = Array.isArray(payload?.applied) ? payload.applied.join(", ") : "";
      setStatus(
        `HTTP ${res.status} • alreadyUpToDate=${String(Boolean(payload?.alreadyUpToDate))} • migrationFilesFound=${String(payload?.migrationFilesFound ?? "?")}${applied ? ` • applied=${applied}` : ""}`,
      );
      setAfterSchema(payload?.after || null);
      setLoading(false);
      return;
    }

    setAfterSchema(payload?.after || null);
    setError(`HTTP ${res.status} • ${payload?.code || "UNKNOWN"} • ${payload?.message || payload?.error || "Request failed"}`);
    setLoading(false);
  };

  const viewSchemaDiagnostics = async () => {
    setDiagOutput("");
    const res = await fetch("/api/dev/schema?table=users", {
      method: "GET",
      headers: {
        "x-stylemingle-admin-token": token,
      },
    });

    const payload = await res.json().catch(() => null);
    setDiagOutput(JSON.stringify({ httpStatus: res.status, ...payload }, null, 2));
  };

  return (
    <div className="max-w-xl rounded-2xl border bg-white p-5" data-testid="dev-migrate-form">
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

        <div className="flex gap-2">
          <button onClick={runMigrations} disabled={loading} className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60">
            {loading ? "Running…" : "Run migrations"}
          </button>
          <button onClick={viewSchemaDiagnostics} className="rounded border px-4 py-2">
            View schema diagnostics
          </button>
        </div>

        {status && <p className="text-sm text-emerald-700">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {afterSchema && (
          <p className="text-sm text-zinc-700" data-testid="after-schema-summary">
            after.hasIsPremium={String(Boolean(afterSchema.hasIsPremium))} • after.detectedPremiumColumnName={String(afterSchema.detectedPremiumColumnName || "null")}
          </p>
        )}

        {diagOutput && (
          <pre className="max-h-64 overflow-auto rounded bg-zinc-100 p-3 text-xs">
            {diagOutput}
          </pre>
        )}
      </div>
    </div>
  );
}
