"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OutfitsPage() {
  const router = useRouter();
  const [occasion, setOccasion] = useState("casual");
  const [weather, setWeather] = useState("");
  const [mood, setMood] = useState("minimalist");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const generate = async () => {
    setError("");
    const res = await fetch("/api/ai/outfit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occasion, weather, mood }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to generate");
      return;
    }
    setResult(data);
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-4">AI Stylist</h1>
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="border rounded p-2">
          {['casual', 'work', 'date', 'event'].map((v) => <option key={v}>{v}</option>)}
        </select>
        <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Weather (optional)" className="border rounded p-2" />
        <select value={mood} onChange={(e) => setMood(e.target.value)} className="border rounded p-2">
          {['minimalist', 'bold', 'relaxed'].map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      <button onClick={generate} className="rounded-xl bg-slate-900 text-white px-4 py-2">Generate outfit</button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-6 bg-white border rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Suggested items</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[result.top, result.bottom, result.shoes, result.outerwear].filter(Boolean).map((item: any) => (
              <div key={item.id} className="rounded-lg border p-2">
                <Image src={item.imageUrl} alt={item.category || "item"} width={240} height={240} className="w-full aspect-square object-cover rounded" unoptimized />
                <p className="text-xs mt-1 capitalize">{item.category}</p>
                <p className="text-xs text-zinc-500">{item.primaryColor || "No color"}</p>
              </div>
            ))}
          </div>

          <h3 className="font-medium mt-4">Why this works</h3>
          <ul className="list-disc ml-5 text-sm">
            {(result.explanation || []).map((line: string, idx: number) => <li key={idx}>{line}</li>)}
          </ul>
          <p className="text-sm mt-2">{result.followUpQuestion}</p>

          <button
            onClick={() => router.push('/dashboard/avatar?outfit=latest')}
            className="mt-4 rounded-lg border px-3 py-2"
          >
            View on Avatar
          </button>
        </div>
      )}
    </div>
  );
}
