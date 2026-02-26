"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type OutfitItem = {
  id: string;
  imageUrl: string;
  category?: string | null;
  primaryColor?: string | null;
};

type OutfitResult = {
  top: OutfitItem | null;
  bottom: OutfitItem | null;
  shoes: OutfitItem | null;
  outerwear: OutfitItem | null;
  explanation: string[] | string;
  followUpQuestion?: string;
};

type WardrobeItem = {
  id: string;
  category?: string | null;
  primaryColor?: string | null;
  styleTag?: string | null;
};

export default function OutfitsPage() {
  const router = useRouter();
  const [occasion, setOccasion] = useState("casual");
  const [weather, setWeather] = useState("");
  const [mood, setMood] = useState("minimalist");
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [error, setError] = useState("");
  const [preflightStatus, setPreflightStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const explanationLines = useMemo(() => {
    if (!result) return [];
    if (Array.isArray(result.explanation)) return result.explanation;
    if (typeof result.explanation === "string" && result.explanation.trim().length > 0) return [result.explanation];
    return [];
  }, [result]);

  const selectedItems: OutfitItem[] = useMemo(() => {
    if (!result) return [];
    return [result.top, result.bottom, result.shoes, result.outerwear].filter((item): item is OutfitItem => Boolean(item));
  }, [result]);

  const countBasics = (items: WardrobeItem[]) => {
    const hasTop = items.some((item) => item.category === "top");
    const hasBottom = items.some((item) => item.category === "bottom");
    const hasShoes = items.some((item) => item.category === "shoes");
    return { hasTop, hasBottom, hasShoes, enough: hasTop && hasBottom && hasShoes };
  };

  const ensureTaggedBasics = async () => {
    const itemsRes = await fetch("/api/wardrobe/items");
    const items = (await itemsRes.json()) as WardrobeItem[];
    if (!itemsRes.ok || !Array.isArray(items)) {
      throw new Error("Failed to load wardrobe");
    }

    const starting = countBasics(items);
    if (starting.enough) return;

    const missingMeta = items.filter((item) => !item.category || !item.primaryColor || !item.styleTag);
    if (missingMeta.length === 0) return;

    setPreflightStatus(`Auto-tagging your closet… (0/${missingMeta.length})`);
    const idBatches: string[][] = [];
    for (let i = 0; i < missingMeta.length; i += 6) {
      idBatches.push(missingMeta.slice(i, i + 6).map((item) => item.id));
    }

    let processed = 0;
    for (const batch of idBatches) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch("/api/ai/wardrobe/tag-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: batch }),
      });

      const payload = await res.json().catch(() => null);
      processed += batch.length;
      setPreflightStatus(`Auto-tagging your closet… (${Math.min(processed, missingMeta.length)}/${missingMeta.length})`);

      if (!res.ok) {
        if (payload?.error === "AI_UNAVAILABLE") {
          setPreflightStatus("");
          setError("Auto-tagging unavailable right now. You can still add details in Wardrobe.");
          return;
        }
        throw new Error("Auto-tagging failed");
      }
    }

    setPreflightStatus("");
  };

  const generate = async () => {
    setError("");
    setLoading(true);
    setPreflightStatus("");
    try {
      await ensureTaggedBasics();
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

      const payload = {
        createdAt: Date.now(),
        occasion,
        weather,
        mood,
        items: {
          top: data.top,
          bottom: data.bottom,
          shoes: data.shoes,
          outerwear: data.outerwear,
        },
        explanation: Array.isArray(data.explanation)
          ? data.explanation
          : typeof data.explanation === "string"
            ? [data.explanation]
            : [],
      };

      localStorage.setItem("sm:latestOutfit", JSON.stringify(payload));
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to generate");
    } finally {
      setLoading(false);
      setPreflightStatus("");
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-4">AI Stylist</h1>
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="border rounded p-2">
          {["casual", "work", "date", "event"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Weather (optional)" className="border rounded p-2" />
        <select value={mood} onChange={(e) => setMood(e.target.value)} className="border rounded p-2">
          {["minimalist", "bold", "relaxed"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <button onClick={generate} disabled={loading} className="rounded-xl bg-slate-900 text-white px-4 py-2 disabled:opacity-60">
        {loading ? "Generating…" : "Generate outfit"}
      </button>
      {preflightStatus && <p className="mt-3 text-sm text-zinc-600">{preflightStatus}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-6 bg-white border rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Suggested items</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {selectedItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-2">
                <Image src={item.imageUrl} alt={item.category || "item"} width={240} height={240} className="w-full aspect-square object-cover rounded" unoptimized />
                <p className="text-xs mt-1 capitalize">{item.category}</p>
                <p className="text-xs text-zinc-500">{item.primaryColor || "No color"}</p>
              </div>
            ))}
          </div>

          <h3 className="font-medium mt-4">Why this works</h3>
          <ul className="list-disc ml-5 text-sm">
            {explanationLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
          <p className="text-sm mt-2">{result.followUpQuestion}</p>

          <button onClick={() => router.push("/dashboard/avatar?outfit=latest")} className="mt-4 rounded-lg border px-3 py-2">
            View on Avatar
          </button>
        </div>
      )}
    </div>
  );
}
