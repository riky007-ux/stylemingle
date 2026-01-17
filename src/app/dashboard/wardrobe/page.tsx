"use client";

import { useEffect, useRef, useState } from "react";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        let message = "Upload failed";

        try {
          const data = await res.json();
          message = data?.error || message;
        } catch {
          const text = await res.text();
          if (res.status === 413) {
            message = "Image too large. Please choose a smaller photo.";
          } else if (text) {
            message = text;
          }
        }

        throw new Error(message);
      }

      const data = await res.json();
      setItems((prev) => [...prev, data]);
    } catch (err: any) {
      console.error("UPLOAD_CLIENT_ERROR", err);
      setError(err.message || "Upload failed");
    }
  };

  return (
    <div>
      <h1>Your Wardrobe</h1>

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
