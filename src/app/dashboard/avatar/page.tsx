"use client";

import { useEffect, useState } from "react";
import { AvatarSVG } from "@/lib/avatar/AvatarSVG";
import { bodySizes } from "@/lib/avatar/registry/body";
import { faceStyles } from "@/lib/avatar/registry/faces";
import { hairStyles } from "@/lib/avatar/registry/hair";
import { skinTones } from "@/lib/avatar/registry/skinTones";
import { DEFAULT_AVATAR_PREFERENCES, HAIR_COLORS, type AvatarPreferences } from "@/lib/avatar/types";

export default function AvatarBuilderPage() {
  const [prefs, setPrefs] = useState<AvatarPreferences>(DEFAULT_AVATAR_PREFERENCES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/avatar/preferences").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setPrefs((p) => ({ ...p, ...data }));
      }
    });
  }, []);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 h-[500px]">
          <AvatarSVG preferences={prefs} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-5">
          <div>
            <p className="font-medium mb-2">Gender</p>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((g) => (
                <button key={g} className={`px-4 py-2 rounded-lg border ${prefs.gender === g ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setPrefs({ ...prefs, gender: g })}>{g === "male" ? "Male" : "Female"}</button>
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
                <button key={style.key} className={`rounded-lg border p-2 text-sm ${prefs.hairStyleKey === style.key ? "border-slate-900 bg-slate-100" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, hairStyleKey: style.key })}>{style.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Hair color</p>
            <div className="flex flex-wrap gap-2">
              {HAIR_COLORS.map((c) => (
                <button key={c.key} className={`px-2 py-1 rounded border text-xs ${prefs.hairColorKey === c.key ? "border-slate-900" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, hairColorKey: c.key })}>{c.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Face preset</p>
            <div className="flex gap-2 flex-wrap">
              {faceStyles.map((f) => (
                <button key={f.key} className={`rounded-lg border px-3 py-1 ${prefs.faceStyleKey === f.key ? "border-slate-900 bg-slate-100" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, faceStyleKey: f.key })}>{f.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">Size</p>
            <div className="flex gap-2">
              {bodySizes.map((size) => (
                <button key={size} className={`rounded-lg border px-3 py-1 ${prefs.bodySize === size ? "border-slate-900 bg-slate-100" : "border-slate-200"}`} onClick={() => setPrefs({ ...prefs, bodySize: size })}>{size}</button>
              ))}
            </div>
          </div>

          <button onClick={save} className="w-full rounded-xl bg-blue-600 text-white py-2 font-medium">Save</button>
          {saved && <p className="text-green-700 text-sm">Saved</p>}
        </div>
      </div>
    </div>
  );
}
