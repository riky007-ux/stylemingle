"use client";

import { useState } from "react";

type Props = {
  initialEmail?: string;
};

export default function DevPremiumForm({ initialEmail = "" }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [enabled, setEnabled] = useState(true);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setStatus("");
    setError("");

    const res = await fetch("/api/dev/premium", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-stylemingle-admin-token": token,
      },
      body: JSON.stringify({ email, enabled, token }),
    });

    const data = await res.json().catch(() => null);
    if (res.ok) {
      setStatus(`Updated ${data?.email || email} -> premium ${String(Boolean(data?.enabled))}`);
      setLoading(false);
      return;
    }

    const code = data?.code || "UNKNOWN";
    const message = data?.message || data?.error || "Request failed";
    setError(`HTTP ${res.status} • ${code} • ${message}`);
    setLoading(false);
  };

  return (
    <div className="max-w-xl rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold mb-2">Dev Premium Toggle</h2>
      <p className="text-sm text-zinc-600 mb-4">Preview/dev helper. Use your admin token and target email.</p>

      <div className="space-y-3" data-testid="dev-premium-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user email"
          className="w-full border rounded p-2"
        />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable premium for this account
        </label>

        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="PREMIUM_ADMIN_TOKEN"
          className="w-full border rounded p-2"
        />

        <button onClick={onSubmit} disabled={loading} className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60">
          {loading ? "Updating…" : "Update premium"}
        </button>

        {status && <p className="text-sm text-emerald-700">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
