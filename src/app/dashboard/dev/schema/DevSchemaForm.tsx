"use client";

import { useState } from "react";

export default function DevSchemaForm() {
  const [token, setToken] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    setStatus("");
    setError("");
    const res = await fetch("/api/dev/schema", {
      headers: {
        "x-stylemingle-admin-token": token,
      },
    });
    const payload = await res.json().catch(() => null);
    setOutput(JSON.stringify({ httpStatus: res.status, ...payload }, null, 2));

    if (!res.ok) {
      setError(`HTTP ${res.status} • ${payload?.code || "UNKNOWN"} • ${payload?.message || "Failed"}`);
      return;
    }

    setStatus(
      `gate12Ready=${String(Boolean(payload?.gate12Ready))} • blockingReasons=${JSON.stringify(payload?.blockingReasons || [])} • after.hasIsPremium=${String(payload?.after?.hasIsPremium)} • after.hasStyleProfileTable=${String(payload?.after?.hasStyleProfileTable)} • after.hasFeedbackColumns=${String(payload?.after?.hasFeedbackColumns)} • commitSha=${String(payload?.buildInfo?.commitSha || "null")}`,
    );
  };

  return (
    <div className="max-w-3xl rounded-2xl border bg-white p-5" data-testid="dev-schema-form">
      <h2 className="text-xl font-semibold mb-2">Dev Schema Diagnostics</h2>
      <p className="text-sm text-zinc-600 mb-4">Load canonical Gate 12 diagnostics payload.</p>

      <div className="space-y-3">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="PREMIUM_ADMIN_TOKEN"
          className="w-full border rounded p-2"
        />
        <button onClick={run} className="rounded bg-slate-900 text-white px-4 py-2">
          Load diagnostics
        </button>

        {status && <p className="text-sm text-emerald-700">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {output && <pre className="max-h-96 overflow-auto rounded bg-zinc-100 p-3 text-xs">{output}</pre>}
      </div>
    </div>
  );
}
