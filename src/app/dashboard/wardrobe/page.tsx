"use client";

import { useRef, useState } from "react";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Uploading...");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      setStatus("Upload successful");
      await handleChooseFromLibrary();
    } catch {
      setStatus("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleChooseFromLibrary() {
    setLoading(true);
    setStatus("Loading wardrobe...");

    try {
      const res = await fetch("/api/wardrobe/items");
      if (!res.ok) throw new Error("Fetch failed");

      const data = await res.json();
      setItems(data);
      setStatus(data.length === 0 ? "No items yet" : null);
    } catch {
      setStatus("Failed to load wardrobe");
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
              gridTemplateColumns:
                "repeat(auto-fill, minmax(120px, 1fr))",
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
