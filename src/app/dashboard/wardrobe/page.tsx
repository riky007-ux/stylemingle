"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { upload } from "@vercel/blob/client";

type WardrobeItem = { id: string; imageUrl: string };

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("authToken") ||
    window.localStorage.getItem("jwt") ||
    window.localStorage.getItem("stylemingle_token")
  );
}

async function readErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  if (!text) return fallback;
  try {
    const data = JSON.parse(text);
    return (data && (data.error || data.message)) || fallback;
  } catch {
    return text;
  }
}

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { logout } = useAuth();

  const fetchItems = async () => {
    try {
      setError(null);
      const token = getToken();

      const res = await fetch("/api/wardrobe/items", {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        logout();
        router.push("/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch wardrobe items");
      }

      const data = await res.json();
      const nextItems: WardrobeItem[] = Array.isArray(data) ? data : data?.items || [];
      setItems(nextItems);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch wardrobe items");
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setError(null);
    try {
      const token = getToken();
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/wardrobe/blob",
      });
      const res = await fetch("/api/wardrobe/items", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageUrl: blob.url }),
      });
      if (res.status === 401) {
        logout();
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, "Upload failed");
        throw new Error(message);
      }
      await fetchItems();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerateOutfit = async () => {
    try {
      const token = getToken();
      const body = { itemIds: items.map((item) => item.id) };
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        logout();
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, "Failed to generate outfit");
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
