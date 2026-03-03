"use client";

import { useState } from "react";

export default function DevMigrateForm() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const runMigrations = async () => {
    setLoading(true);
    setStatus("");
    setError("");

    const res = await fetch("/api/dev/migrate", {
      method: "POST",
      headers: {
        "x-stylemingle-admin-token": token,
      },
    });

    const payload = await res.json().catch(() => null);
    if (res.ok) {
      const applied = Array.isArray(payload?.applied) ? payload.applied.join(", ") : "";
      setStatus(`HTTP ${res.status} • alreadyUpToDate=${String(Boolean(payload?.alreadyUpToDate))}${applied ? ` • applied=${applied}` : ""}`);
      setLoading(false);
      return;
    }

    setError(`HTTP ${res.status} • ${payload?.code || "UNKNOWN"} • ${payload?.message || payload?.error || "Request failed"}`);
    setLoading(false);
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

        <button onClick={runMigrations} disabled={loading} className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60">
          {loading ? "Running…" : "Run migrations"}
        </button>

        {status && <p className="text-sm text-emerald-700">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
