"use client";

import { useEffect, useRef, useState } from "react";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

type Outfit = {
  id: string;
  name: string;
  description: string;
  items: string[];
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("authToken") ||
    window.localStorage.getItem("jwt") ||
    window.localStorage.getItem("stylemingle_token")
  );
}

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [generatedOutfit, setGeneratedOutfit] = useState<Outfit | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load wardrobe items
  useEffect(() => {
    async function loadWardrobe() {
      const token = getAuthToken();
      if (!token) return;
      try {
        const res = await fetch("/api/wardrobe/items", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setItems(data);
        }
      } catch (err) {
        console.error("Failed to load wardrobe:", err);
      }
    }
    loadWardrobe();
  }, []);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated. Please log in again.");
      return;
    }

    setLoading(true);
    setStatus("Uploading…");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Upload failed");
      }

      // Optimistically add the uploaded item
      setItems((prev) => [
        ...prev,
        {
          id: data.id,
          imageUrl: data.imageUrl,
        },
      ]);

      setStatus(null);
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Upload failed");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleGenerateOutfit() {
    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated. Please log in again.");
      return;
    }
    if (items.length < 2) {
      setStatus("Upload at least two items to generate an outfit.");
      return;
    }

    setLoading(true);
    setStatus("Generating outfit…");

    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to generate outfit");
      }

      setGeneratedOutfit(data);
      setOutfits((prev) => [data, ...prev]);
      setStatus(null);
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Failed to generate outfit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 max-w-7xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">Your Wardrobe</h1>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleUploadClick}
          disabled={loading}
          className="border rounded-md px-4 py-3 hover:bg-gray-100 disabled:opacity-50"
        >
          Upload New Item
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {status && (
        <p className="mt-4 text-sm text-gray-600">{status}</p>
      )}

      <div className="mt-6">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm p-2 flex items-center justify-center"
              >
                <img
                  src={item.imageUrl}
                  alt="Wardrobe item"
                  className="max-h-40 object-contain"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Your wardrobe is empty. Start by uploading your first item.
          </p>
        )}
      </div>

      <div className="mt-10 pt-8 border-t">
        <h2 className="text-2xl font-semibold mb-4">
          Generate Outfit
        </h2>
        <button
          onClick={handleGenerateOutfit}
          disabled={loading}
          className="border rounded-md px-4 py-3 hover:bg-gray-100 disabled:opacity-50"
        >
          Generate Outfit
        </button>

        {generatedOutfit && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium">
              {generatedOutfit.name}
            </h3>
            <p className="text-gray-700 mt-2">
              {generatedOutfit.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
