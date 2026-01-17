"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch("/api/wardrobe");
        if (!res.ok) {
          throw new Error("Failed to fetch wardrobe items");
        }
        const data = await res.json();
        setItems(data.items || []);
      } catch (err: any) {
        console.error(err);
      }
    };
    fetchItems();
  }, []);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setError(null);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token") ||
            window.localStorage.getItem("authToken") ||
            window.localStorage.getItem("jwt") ||
            window.localStorage.getItem("stylemingle_token")
          : null;
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const text = await res.text();
      if (!res.ok) {
        let message = "Upload failed";
        if (text) {
          try {
            const data = JSON.parse(text);
            message = (data && (data.error || data.message)) || message;
          } catch {
            message = text;
          }
        }
        if (res.status === 413) {
          message = "Image too large. Please upload a smaller image.";
        }
        throw new Error(message);
      } else {
        let parsed: any = {};
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            // ignore parse errors
          }
        }
        if (parsed && parsed.item) {
          setItems((prev) => [...prev, parsed.item]);
        }
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    }
  };

  const handleGenerateOutfit = async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token") ||
            window.localStorage.getItem("authToken") ||
            window.localStorage.getItem("jwt") ||
            window.localStorage.getItem("stylemingle_token")
          : null;

      const body = { itemIds: items.map((item) => item.id) };
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = "Failed to generate outfit";
        if (text) {
          try {
            const data = JSON.parse(text);
            message = (data && (data.error || data.message)) || message;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }
      alert("Outfit generated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to generate outfit");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/avatar")}
          style={{
            padding: "8px 12px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: "4px",
          }}
        >
          Go to Avatar
        </button>
        <button
          type="button"
          onClick={handleGenerateOutfit}
          style={{
            padding: "8px 12px",
            background: "#10b981",
            color: "#fff",
            borderRadius: "4px",
          }}
        >
          Generate Outfit
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      {error && <p style={{ color: "red" }}>{error}</p>}
      {items.length === 0 ? (
        <p>Your wardrobe is empty. Start by uploading your first item.</p>
      ) : (
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          {items.map((item) => (
            <img
              key={item.id}
              src={item.imageUrl}
              alt="Wardrobe item"
              style={{ width: "120px", height: "auto" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
