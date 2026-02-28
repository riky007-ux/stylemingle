"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvatarSVG } from "@/lib/avatar/AvatarSVG";
import { AvatarV2SVG } from "@/lib/avatar/AvatarV2SVG";
import { bodySizes } from "@/lib/avatar/registry/body";
import { faceStyles } from "@/lib/avatar/registry/faces";
import { hairStyles } from "@/lib/avatar/registry/hair";
import { skinTones } from "@/lib/avatar/registry/skinTones";
import { readEnhancedImageMap } from "@/lib/client/enhancedImageCache";
import { DEFAULT_AVATAR_PREFERENCES, HAIR_COLORS, type AvatarPreferences } from "@/lib/avatar/types";

type OutfitPreviewItem = { id: string; imageUrl?: string; category?: string | null; primaryColor?: string | null };
type LatestOutfitPayload = {
  createdAt: number;
  items: {
    top?: OutfitPreviewItem | null;
    bottom?: OutfitPreviewItem | null;
    shoes?: OutfitPreviewItem | null;
    outerwear?: OutfitPreviewItem | null;
  };
};

type FitAdjust = { scale: number; x: number; y: number };
type FitMap = Record<"top" | "bottom" | "shoes", FitAdjust>;

const AVATAR_V2_ENABLED = process.env.NEXT_PUBLIC_AVATAR_V2 === "1";
const BG_REMOVAL_ENABLED = process.env.NEXT_PUBLIC_BG_REMOVAL === "1";
const DEBUG_FLAGS_ENABLED = process.env.NEXT_PUBLIC_DEBUG_FLAGS === "1";
const FIT_KEY = "sm:avatarFitAdjust-v2";

const DEFAULT_FIT: FitMap = {
  top: { scale: 1.05, x: 0, y: -14 },
  bottom: { scale: 1, x: 0, y: 68 },
  shoes: { scale: 0.9, x: 0, y: 150 },
};

function ExperimentalIndicator() {
  if (!DEBUG_FLAGS_ENABLED) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-semibold">Experimental features</p>
      <p>BG Removal: <span className="font-semibold">{BG_REMOVAL_ENABLED ? "ON" : "OFF"}</span></p>
      <p>Avatar v2: <span className="font-semibold">{AVATAR_V2_ENABLED ? "ON" : "OFF"}</span></p>
      {(!BG_REMOVAL_ENABLED || !AVATAR_V2_ENABLED) && (
        <p className="mt-1">Enable in Vercel Preview env vars and redeploy: NEXT_PUBLIC_BG_REMOVAL=1, NEXT_PUBLIC_AVATAR_V2=1</p>
      )}
    </div>
  );
}

export default function AvatarClient() {
  const searchParams = useSearchParams();
  const [prefs, setPrefs] = useState<AvatarPreferences>(DEFAULT_AVATAR_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [latestOutfit, setLatestOutfit] = useState<LatestOutfitPayload | null>(null);
  const [fit, setFit] = useState<FitMap>(DEFAULT_FIT);
  const [enhancedMap, setEnhancedMap] = useState<Record<string, string>>({});
  const outfitParam = searchParams?.get("outfit") ?? null;

  useEffect(() => {
    fetch("/api/avatar/preferences").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setPrefs((p) => ({ ...p, ...data }));
      }
    });

    if (AVATAR_V2_ENABLED) {
      try {
        const raw = localStorage.getItem(FIT_KEY);
        if (raw) {
          setFit((prev) => ({ ...prev, ...JSON.parse(raw) }));
        }
      } catch {
        setFit(DEFAULT_FIT);
      }
    }

    setEnhancedMap(readEnhancedImageMap());
  }, []);

  useEffect(() => {
    if (!AVATAR_V2_ENABLED) return;
    localStorage.setItem(FIT_KEY, JSON.stringify(fit));
  }, [fit]);

  useEffect(() => {
    if (outfitParam !== "latest") {
      setLatestOutfit(null);
      return;
    }

    try {
      const raw = localStorage.getItem("sm:latestOutfit");
      if (!raw) {
        setLatestOutfit(null);
        return;
      }
      const parsed = JSON.parse(raw);
      setLatestOutfit({ createdAt: parsed.createdAt, items: parsed.items || {} });
    } catch {
      setLatestOutfit(null);
    }
  }, [outfitParam]);

  const save = async () => {
    const res = await fetch("/api/avatar/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  const overlaySlots = useMemo(() => {
    if (!latestOutfit || !AVATAR_V2_ENABLED) return [];
    return (["top", "bottom", "shoes"] as const)
      .map((slot) => ({ slot, item: latestOutfit.items[slot] }))
      .filter((entry) => entry.item?.imageUrl);
  }, [latestOutfit]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <h1 className="text-3xl font-semibold mb-4">Avatar Builder</h1>
      <ExperimentalIndicator />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 h-[500px] xl:col-span-1 relative overflow-hidden" data-testid={AVATAR_V2_ENABLED ? "avatar-v2-enabled" : "avatar-v1-enabled"}>
          {AVATAR_V2_ENABLED ? <AvatarV2SVG preferences={prefs} /> : <AvatarSVG preferences={prefs} />}
          {overlaySlots.map(({ slot, item }) => {
            if (!item?.imageUrl) return null;
            const src = enhancedMap[item.id] || item.imageUrl;
            const adjust = fit[slot];
            return (
              <div
                key={item.id}
                data-testid={`outfit-overlay-${slot}`}
                className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2"
                style={{
                  transform: `translate(-50%, -50%) translate(${adjust.x}px, ${adjust.y}px) scale(${adjust.scale})`,
                  filter: enhancedMap[item.id] ? "drop-shadow(0 4px 10px rgba(15,23,42,0.2))" : "drop-shadow(0 4px 12px rgba(15,23,42,0.18))",
                }}
              >
                <Image src={src} alt={`${slot} preview`} fill className={`object-contain ${enhancedMap[item.id] ? "" : "rounded-lg border border-white/70 bg-white/40 p-1"}`} unoptimized />
              </div>
            );
          })}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-5 xl:col-span-1">
          <div>
            <p className="font-medium mb-2">Gender</p>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((g) => (
                <button key={g} className={`px-4 py-2 rounded-lg border ${prefs.gender === g ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setPrefs({ ...prefs, gender: g })}>
                  {g === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">Skin tone</p>
            <div className="flex flex-wrap gap-2">
              {skinTones.map((tone) => (
                <button key={tone.key} aria-label={tone.label} className={`w-8 h-8 rounded-full border-2 ${prefs.skinToneKey === tone.key ? "border-slate-900" : "border-slate-200"}`} style={{ backgroundColor: tone.fill }} onClick={() => setPrefs({ ...prefs, skinToneKey: tone.key })} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">Hair style</p>
            <div className="grid grid-cols-2 gap-2">
              {hairStyles.map((style) => (
                <button key={style.key} className={`rounded-lg border p-2 text-sm ${prefs.hairStyleKey === style.key ? "border-slate-900 bg-slate-100" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, hairStyleKey: style.key })}>
                  {style.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">Hair color</p>
            <div className="flex flex-wrap gap-2">
              {HAIR_COLORS.map((c) => (
                <button key={c.key} className={`px-2 py-1 rounded border text-xs ${prefs.hairColorKey === c.key ? "border-slate-900" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, hairColorKey: c.key })}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">Face preset</p>
            <div className="flex gap-2 flex-wrap">
              {faceStyles.map((f) => (
                <button key={f.key} className={`rounded-lg border px-3 py-1 ${prefs.faceStyleKey === f.key ? "border-slate-900 bg-slate-100" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, faceStyleKey: f.key })}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">Size</p>
            <div className="flex gap-2">
              {bodySizes.map((size) => (
                <button key={size} className={`rounded-lg border px-3 py-1 ${prefs.bodySize === size ? "border-slate-900 bg-slate-100" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, bodySize: size })}>
                  {size}
                </button>
              ))}
            </div>
          </div>

          {AVATAR_V2_ENABLED && (
            <details className="rounded-lg border p-3" open data-testid="avatar-fit-controls">
              <summary className="cursor-pointer text-sm font-medium">Adjust fit</summary>
              <p className="mt-2 text-xs text-zinc-500">Best results with BG removal enabled.</p>
              <div className="mt-3 space-y-3">
                {(["top", "bottom", "shoes"] as const).map((slot) => (
                  <div key={slot} className="rounded border p-2 text-xs">
                    <p className="font-semibold capitalize mb-1">{slot}</p>
                    <label className="block">Scale
                      <input type="range" min="0.6" max="1.4" step="0.01" value={fit[slot].scale} onChange={(e) => setFit((prev) => ({ ...prev, [slot]: { ...prev[slot], scale: Number(e.target.value) } }))} />
                    </label>
                    <label className="block">X Offset
                      <input type="range" min="-80" max="80" step="1" value={fit[slot].x} onChange={(e) => setFit((prev) => ({ ...prev, [slot]: { ...prev[slot], x: Number(e.target.value) } }))} />
                    </label>
                    <label className="block">Y Offset
                      <input type="range" min="-120" max="180" step="1" value={fit[slot].y} onChange={(e) => setFit((prev) => ({ ...prev, [slot]: { ...prev[slot], y: Number(e.target.value) } }))} />
                    </label>
                  </div>
                ))}
              </div>
            </details>
          )}

          <button onClick={save} className="w-full rounded-xl bg-blue-600 text-white py-2 font-medium">Save</button>
          {saved && <p className="text-green-700 text-sm">Saved</p>}
        </div>

        <aside className="bg-white rounded-2xl shadow-sm p-4 xl:col-span-1">
          <h2 className="font-semibold text-lg mb-2">Outfit Preview</h2>
          {latestOutfit ? (
            <>
              <p className="text-xs text-zinc-500 mb-3">Linked from latest outfit suggestion.</p>
              <ul className="space-y-2 text-sm">
                {(["top", "bottom", "shoes", "outerwear"] as const).map((slot) => {
                  const item = latestOutfit.items[slot];
                  return (
                    <li key={slot} className="rounded-lg border p-2">
                      <p className="font-medium capitalize">{slot}</p>
                      {item ? <p className="text-zinc-600">{item.primaryColor || "Tagged item"}</p> : <p className="text-zinc-400">Not selected</p>}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No outfit selected yet. Generate one in Outfits.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
