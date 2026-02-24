"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvatarSVG } from "@/lib/avatar/AvatarSVG";
import { bodySizes } from "@/lib/avatar/registry/body";
import { faceStyles } from "@/lib/avatar/registry/faces";
import { hairStyles } from "@/lib/avatar/registry/hair";
import { skinTones } from "@/lib/avatar/registry/skinTones";
import { DEFAULT_AVATAR_PREFERENCES, HAIR_COLORS, type AvatarPreferences } from "@/lib/avatar/types";

type OutfitPreviewItem = { id: string; category?: string | null; primaryColor?: string | null };
type LatestOutfitPayload = {
  createdAt: number;
  items: {
    top?: OutfitPreviewItem | null;
    bottom?: OutfitPreviewItem | null;
    shoes?: OutfitPreviewItem | null;
    outerwear?: OutfitPreviewItem | null;
  };
};

export default function AvatarBuilderPage() {
  const searchParams = useSearchParams();
  const [prefs, setPrefs] = useState<AvatarPreferences>(DEFAULT_AVATAR_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [latestOutfit, setLatestOutfit] = useState<LatestOutfitPayload | null>(null);

  useEffect(() => {
    fetch("/api/avatar/preferences").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setPrefs((p) => ({ ...p, ...data }));
      }
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("outfit") !== "latest") {
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
      setLatestOutfit({
        createdAt: parsed.createdAt,
        items: parsed.items || {},
      });
    } catch {
      setLatestOutfit(null);
    }
  }, [searchParams]);

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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <h1 className="text-3xl font-semibold mb-4">Avatar Builder</h1>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 h-[500px] xl:col-span-1">
          <AvatarSVG preferences={prefs} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-5 xl:col-span-1">
          <div>
            <p className="font-medium mb-2">Gender</p>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  className={`px-4 py-2 rounded-lg border ${prefs.gender === g ? "bg-slate-900 text-white" : "bg-white"}`}
                  onClick={() => setPrefs({ ...prefs, gender: g })}
                >
                  {g === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Skin tone</p>
            <div className="flex flex-wrap gap-2">
              {skinTones.map((tone) => (
                <button
                  key={tone.key}
                  aria-label={tone.label}
                  className={`w-8 h-8 rounded-full border-2 ${prefs.skinToneKey === tone.key ? "border-slate-900" : "border-slate-200"}`}
                  style={{ backgroundColor: tone.fill }}
                  onClick={() => setPrefs({ ...prefs, skinToneKey: tone.key })}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Hair style</p>
            <div className="grid grid-cols-2 gap-2">
              {hairStyles.map((style) => (
                <button
                  key={style.key}
                  className={`rounded-lg border p-2 text-sm ${prefs.hairStyleKey === style.key ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}
                  onClick={() => setPrefs({ ...prefs, hairStyleKey: style.key })}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Hair color</p>
            <div className="flex flex-wrap gap-2">
              {HAIR_COLORS.map((c) => (
                <button
                  key={c.key}
                  className={`px-2 py-1 rounded border text-xs ${prefs.hairColorKey === c.key ? "border-slate-900" : "border-slate-200"}`}
                  onClick={() => setPrefs({ ...prefs, hairColorKey: c.key })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Face preset</p>
            <div className="flex gap-2 flex-wrap">
              {faceStyles.map((f) => (
                <button
                  key={f.key}
                  className={`rounded-lg border px-3 py-1 ${prefs.faceStyleKey === f.key ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}
                  onClick={() => setPrefs({ ...prefs, faceStyleKey: f.key })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Size</p>
            <div className="flex gap-2">
              {bodySizes.map((size) => (
                <button
                  key={size}
                  className={`rounded-lg border px-3 py-1 ${prefs.bodySize === size ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}
                  onClick={() => setPrefs({ ...prefs, bodySize: size })}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button onClick={save} className="w-full rounded-xl bg-blue-600 text-white py-2 font-medium">
            Save
          </button>
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
