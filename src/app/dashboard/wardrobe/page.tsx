"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

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

  // Try JSON first
  try {
    const data = JSON.parse(text);
    return (data && (data.error || data.message)) || fallback;
  } catch {
    // Otherwise plain text/HTML
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
      // items route returns an array, but be defensive
      const nextItems: WardrobeItem[] = Array.isArray(data)
        ? data
        : data?.items || [];
      setItems(nextItems);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch wardrobe items");
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setError(null);

    // client-side size guard (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Please upload a smaller image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/wardrobe/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (res.status === 401) {
        logout();
        router.push("/login");
        return;
      }

      if (!res.ok) {
        let message = await readErrorMessage(res, "Upload failed");
        if (res.status === 413) {
          message = "Image too large. Please upload a smaller image.";
        }
        throw new Error(message);
      }

      // Some implementations return {success:true, imageUrl/url...}
      // We don't need to parse it strictly; we just refresh.
      await fetchItems();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      // always reset file input after upload attempt
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
