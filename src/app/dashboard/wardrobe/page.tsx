"use client";

import { useRef, useState } from "react";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Try the most common keys (your auth context likely stores one of these)
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

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      // Convert image to data URL so backend can store it in imageUrl
      const imageUrl = await fileToDataUrl(file);

      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl }),
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
      // Reset input so selecting the same file again triggers onChange
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

  return (
    <div style={{ padding: "24px" }}>
      <h1>Wardrobe</h1>

      <div style={{ marginTop: "16px" }}>
        <button onClick={handleUploadClick} disabled={loading}>
          Upload New Item
        </button>

        <button
          onClick={handleChooseFromLibrary}
          style={{ marginLeft: "12px" }}
          disabled={loading}
        >
          Choose from Library
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {status && <p style={{ marginTop: "16px" }}>{status}</p>}

      <div style={{ marginTop: "24px" }}>
        {items.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: "12px",
            }}
          >
            {items.map((item) => (
              <img
                key={item.id}
                src={item.imageUrl}
                alt="Wardrobe item"
                style={{ width: "100%", borderRadius: "8px" }}
              />
            ))}
          </div>
        ) : (
          !status && <p>Your wardrobe is empty.</p>
        )}
      </div>
    </div>
  );
}
