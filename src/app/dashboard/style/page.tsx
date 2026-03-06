"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const VIBES = ["minimalist", "streetwear", "classic", "sporty", "smart-casual"];
const FITS = ["tailored", "relaxed", "oversized", "athletic"];

type ViewState = "loading" | "ready" | "unauthenticated" | "locked" | "schemaPending" | "error";

export default function StyleProfilePage() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [styleVibes, setStyleVibes] = useState<string[]>([]);
  const [fitPreference, setFitPreference] = useState("tailored");
  const [comfortFashion, setComfortFashion] = useState(50);
  const [colorsLove, setColorsLove] = useState("");
  const [colorsAvoid, setColorsAvoid] = useState("");

  const loadProfile = useCallback(async () => {
    setSaved("");
    setError("");
    setViewState("loading");

    const res = await fetch("/api/style-profile");
    const data = await res.json().catch(() => null);

    if (res.status === 401) {
      setViewState("unauthenticated");
      return;
    }

    if (res.status === 403) {
      setViewState("locked");
      return;
    }

    if (res.status === 503 && data?.code === "PERSONALIZATION_SCHEMA_PENDING") {
      setViewState("schemaPending");
      return;
    }

    if (!res.ok || !data?.profile) {
      setError("Failed to load style profile");
      setViewState("error");
      return;
    }

    setStyleVibes(Array.isArray(data.profile.styleVibes) ? data.profile.styleVibes : []);
    setFitPreference(data.profile.fitPreference || "tailored");
    setComfortFashion(typeof data.profile.comfortFashion === "number" ? data.profile.comfortFashion : 50);
    setColorsLove((data.profile.colorsLove || []).join(", "));
    setColorsAvoid((data.profile.colorsAvoid || []).join(", "));
    setViewState("ready");
  }, []);

  useEffect(() => {
    loadProfile().catch(() => {
      setError("Failed to load style profile");
      setViewState("error");
    });
  }, [loadProfile]);

  const toggleVibe = (vibe: string) => {
    setStyleVibes((prev) => (prev.includes(vibe) ? prev.filter((v) => v !== vibe) : prev.length >= 3 ? prev : [...prev, vibe]));
  };

  const save = async () => {
    setSaving(true);
    setSaved("");
    setError("");

    const res = await fetch("/api/style-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        styleVibes,
        fitPreference,
        comfortFashion,
        colorsLove: colorsLove.split(",").map((v) => v.trim()).filter(Boolean),
        colorsAvoid: colorsAvoid.split(",").map((v) => v.trim()).filter(Boolean),
      }),
    });

    const payload = await res.json().catch(() => null);
    if (res.status === 503 && payload?.code === "PERSONALIZATION_SCHEMA_PENDING") {
      setViewState("schemaPending");
      setSaving(false);
      return;
    }

    if (!res.ok) {
      setError("Save failed");
      setSaving(false);
      return;
    }

    setSaved("Saved");
    setSaving(false);
  };

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto" data-testid="style-profile-page">
      <h1 className="text-3xl font-semibold mb-2">Style Preferences</h1>
      <p className="text-zinc-600 mb-6">Save your style memory to make outfit recommendations feel more like you.</p>

      {viewState === "loading" && <div>Loading…</div>}

      {viewState === "unauthenticated" && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4" data-testid="style-profile-login-needed">
          <p className="font-medium">Please log in to set style preferences.</p>
          <Link className="mt-2 inline-block text-sm underline" href="/login">
            Go to login
          </Link>
        </div>
      )}

      {viewState === "locked" && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4" data-testid="style-profile-lock">
          <p className="font-medium">Memory is Premium</p>
          <p className="text-sm text-zinc-700">Upgrade your plan to unlock cross-session style memory and learning.</p>
          <button onClick={() => loadProfile()} className="mt-3 rounded border px-3 py-1 text-sm">
            Check again
          </button>
        </div>
      )}

      {viewState === "schemaPending" && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-4" data-testid="style-profile-schema-pending">
          <p className="font-medium">Style memory is deploying, try again in a moment.</p>
          <p className="text-sm text-zinc-700">We’re finishing a background database update for personalization.</p>
          <button onClick={() => loadProfile()} className="mt-3 rounded border px-3 py-1 text-sm">
            Retry
          </button>
        </div>
      )}

      {viewState === "error" && <p className="text-sm text-red-600">{error}</p>}

      {viewState === "ready" && (
        <div className="space-y-6 bg-white border rounded-2xl p-5">
          <section>
            <h2 className="font-medium mb-2">Pick up to 3 vibes</h2>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => toggleVibe(vibe)}
                  className={`rounded-full px-3 py-1 text-sm border ${styleVibes.includes(vibe) ? "bg-slate-900 text-white" : "bg-white"}`}
                >
                  {vibe}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-medium mb-2">Fit preference</h2>
            <select className="border rounded p-2" value={fitPreference} onChange={(e) => setFitPreference(e.target.value)}>
              {FITS.map((fit) => (
                <option key={fit} value={fit}>
                  {fit}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h2 className="font-medium mb-2">Comfort vs Fashion ({comfortFashion})</h2>
            <input type="range" min={0} max={100} value={comfortFashion} onChange={(e) => setComfortFashion(Number(e.target.value))} className="w-full" />
          </section>

          <section className="grid md:grid-cols-2 gap-3">
            <input className="border rounded p-2" value={colorsLove} onChange={(e) => setColorsLove(e.target.value)} placeholder="Colors you love (comma separated)" />
            <input className="border rounded p-2" value={colorsAvoid} onChange={(e) => setColorsAvoid(e.target.value)} placeholder="Colors to avoid (comma separated)" />
          </section>

          <button onClick={save} disabled={saving} className="rounded-xl bg-slate-900 text-white px-4 py-2 disabled:opacity-50">
            {saving ? "Saving…" : "Save preferences"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-700">{saved}</p>}
        </div>
      )}
    </div>
  );
}
