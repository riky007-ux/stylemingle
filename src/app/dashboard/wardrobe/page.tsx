"use client";
import { useRef, useState, useEffect } from "react";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

type Outfit = {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  createdAt: number;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function compressImage(
  file: File,
  maxWidth = 1024,
  quality = 0.75
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context is not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed"));
            return;
          }
          const compressedFile = new File([blob], file.name, { type: blob.type });
          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = (err) => reject(err);
    img.src = URL.createObjectURL(file);
  });
}

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // state for generated outfit
  const [generatedOutfit, setGeneratedOutfit] = useState<{ name: string; description: string; items: string[] } | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);

  // outfit history
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  // fetch outfits on mount
  useEffect(() => {
    async function fetchOutfits() {
      const token = getAuthToken();
      if (!token) return;
      try {
        const res = await fetch("/api/outfits", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setOutfits(data);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchOutfits();
  }, []);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated (missing token). Please log in again.");
      return;
    }
    setStatus("Uploading...");
    setLoading(true);
    try {
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressedFile);
      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}) ${text}`);
      }
      setStatus("Upload successful");
      await handleChooseFromLibrary();
    } catch (err: any) {
      setStatus(err?.message || "Upload failed");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleChooseFromLibrary() {
    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated (missing token). Please log in again.");
      return;
    }
    setLoading(true);
    setStatus("Loading wardrobe...");
    try {
      const res = await fetch("/api/wardrobe/items", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to load wardrobe (${res.status}) ${text}`);
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setStatus(data?.length ? null : "No items yet");
    } catch (err: any) {
      setStatus(err?.message || "Failed to load wardrobe");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(itemId: string) {
    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated (missing token). Please log in again.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to delete this item?");
    if (!confirmDelete) {
      return;
    }
    try {
      const res = await fetch(`/api/wardrobe/items/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to delete item (${res.status}) ${text}`);
      }
      setItems((prev) => prev.filter((it) => it.id !== itemId));
    } catch (err: any) {
      setStatus(err?.message || "Failed to delete item");
    }
  }

  async function handleGenerateOutfit() {
    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated (missing token). Please log in again.");
      return;
    }
    if (items.length < 2) {
      setStatus("Not enough items in wardrobe to generate an outfit.");
      return;
    }
    setGenerateLoading(true);
    setStatus("Generating outfit...");
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
      setStatus(null);
      // append to history
      setOutfits((prev) => [data, ...prev]);
    } catch (err: any) {
      setStatus(err?.message || "Failed to generate outfit");
    } finally {
      setGenerateLoading(false);
    }
  }

  async function handleRegenerate(outfitId: string) {
    const token = getAuthToken();
    if (!token) {
      setStatus("Not authenticated (missing token). Please log in again.");
      return;
    }
    const instruction = window.prompt("Enter any additional instructions (optional):", "") || "";
    try {
      const res = await fetch("/api/outfits/regenerate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outfitId, instruction }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to regenerate outfit");
      }
      // update history
      setOutfits((prev) => [data, ...prev]);
      setGeneratedOutfit(data);
      setStatus(null);
    } catch (err: any) {
      setStatus(err?.message || "Failed to regenerate outfit");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold mb-4">Your Wardrobe</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleUploadClick}
          disabled={loading}
          className="border rounded-md px-4 py-2 hover:bg-gray-100 disabled:opacity-50 w-full sm:w-auto"
        >
          Upload New Item
        </button>
        <button
          onClick={handleChooseFromLibrary}
          disabled={loading}
          className="border rounded-md px-4 py-2 hover:bg-gray-100 disabled:opacity-50 w-full sm:w-auto"
        >
          Choose from Library
        </button>
        <button
          onClick={handleGenerateOutfit}
          disabled={loading || generateLoading || items.length < 2}
          className="border rounded-md px-4 py-2 hover:bg-gray-100 disabled:opacity-50 w-full sm:w-auto"
        >
          {generateLoading ? "Generating..." : "Generate Outfit"}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {status && <p className="mt-4 text-sm text-gray-600">{status}</p>}
      <div className="mt-6">
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col"
              >
                <img
                  src={item.imageUrl}
                  alt="Wardrobe item"
                  className="object-cover w-full h-40"
                />
                <div className="p-2 flex justify-end">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !status && <p className="text-gray-500">Your wardrobe is empty.</p>
        )}
      </div>
      {generatedOutfit && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-2">Outfit Suggestions</h2>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-medium">{generatedOutfit.name}</h3>
            <p className="mt-1 text-gray-700">{generatedOutfit.description}</p>
            <div className="flex flex-wrap gap-3 mt-3">
              {generatedOutfit.items.map((id) => {
                const item = items.find((it) => it.id === id);
                return item ? (
                  <img
                    key={id}
                    src={item.imageUrl}
                    alt="Outfit item"
                    className="w-24 h-24 object-cover rounded-md"
                  />
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-2">Outfit History</h2>
        {outfits.length > 0 ? (
          outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="bg-white rounded-lg shadow-sm p-4 mb-4"
            >
              <h3 className="text-lg font-medium">{outfit.name}</h3>
              <p className="text-gray-700">{outfit.description}</p>
              <button
                onClick={() => handleRegenerate(outfit.id)}
                className="mt-2 text-blue-600 hover:underline"
              >
                Regenerate
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No outfit history yet.</p>
        )}
      </div>
    </div>
  );
}
