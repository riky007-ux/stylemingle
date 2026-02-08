"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type WardrobeItem = {
  id: string;
  imageUrl: string;
};

/**
 * Client-safe unique ID generator.
 * No Node APIs, no window usage, build-safe.
 */
function safeUUID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  async function loadItems() {
    try {
      const res = await fetch("/api/wardrobe/items");
      if (!res.ok) throw new Error("Failed to load wardrobe");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load wardrobe");
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleUpload(file: File) {
    setError(null);
    setUploadNotice(null);
    setLoading(true);

    let fileToUpload = file;
    let uploadExt =
      (file.name.split(".").pop() || "").toLowerCase() || "bin";

    const isHeic =
      uploadExt === "heic" ||
      uploadExt === "heif" ||
      (file.type || "").toLowerCase().includes("heic") ||
      (file.type || "").toLowerCase().includes("heif");

    if (isHeic) {
      try {
        // 🔑 Dynamic import — ONLY runs in browser after user action
        const heic2any = (await import("heic2any")).default;

        const result: any = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });

        const jpegBlob = Array.isArray(result) ? result[0] : result;

        if (jpegBlob instanceof Blob) {
          fileToUpload = new File([jpegBlob], `${safeUUID()}.jpg`, {
            type: "image/jpeg",
          });
          uploadExt = "jpg";
        } else {
          console.error("HEIC_CONVERSION_UNEXPECTED_RESULT", result);
          setUploadNotice(
            "Preview may not render in all browsers. Original file saved."
          );
          fileToUpload = file;
        }
      } catch (err) {
        console.error("HEIC_CONVERSION_FAILED_FALLBACK", err);
        setUploadNotice(
          "Preview may not render in all browsers. Original file saved."
        );
        fileToUpload = file;
      }
    }

    try {
      const blob = await upload(
        `wardrobe/${safeUUID()}.${uploadExt}`,
        fileToUpload,
        {
          access: "public",
          handleUploadUrl: "/api/wardrobe/blob",
        }
      );

      const res = await fetch("/api/wardrobe/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: blob.url }),
      });

      if (!res.ok) throw new Error("Failed to save wardrobe item");

      await loadItems();
    } catch (err) {
      console.error(err);
      setError("Upload failed");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Wardrobe</h1>

      <p className="text-sm text-zinc-600 mb-4">
        Upload outfit pieces and manage your wardrobe.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      {uploadNotice && (
        <div className="mt-2 text-sm text-zinc-600">
          {uploadNotice}
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-4 text-sm text-zinc-600">
          Uploading…
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="aspect-square overflow-hidden rounded border"
          >
            <img
              src={item.imageUrl}
              alt="Wardrobe item"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
