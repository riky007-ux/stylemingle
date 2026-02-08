"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { upload } from "@vercel/blob/client";

declare module "heic2any";

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

async function readErrorMessage(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) return fallback;

  try {
    const data = JSON.parse(text);
    return (data.error?.message || data.message) || fallback;
  } catch (data) {
    return (data?.error?.message || data?.message) || fallback;
  }
}

async function fetchItems(token: string): Promise<WardrobeItem[]> {
  const response = await fetch("/api/wardrobe/items", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch wardrobe items"));
  }

  const data = (await response.json()) as { items?: WardrobeItem[] };
  return data.items || [];
}

function safeRandomUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();

  // Good enough uniqueness for blob paths if crypto isn't available.
  return `uuid_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function fileExtensionFromName(name: string) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) return "";
  return name.slice(lastDot + 1).toLowerCase();
}

function fileExtensionFromMime(type: string) {
  const parts = type.split("/");
  return parts.length === 2 ? parts[1].toLowerCase() : "";
}

async function convertHeicToJpeg(file: File) {
  const lowerName = file.name.toLowerCase();
  const looksHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif");

  if (!looksHeic) return file;

  const heic2any = (await import("heic2any")).default as any;

  const converted: Blob = await heic2any({
    blob: file,
    toType: "image/jpeg",
  });

  const blob = converted instanceof Blob ? converted : new Blob([converted], { type: "image/jpeg" });
  return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export default function WardrobePage() {
  const router = useRouter();
  const { logout } = useAuth();

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadItems = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setIsLoading(true);
      const nextItems = await fetchItems(token);
      setItems(nextItems);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    // Allow the same file to be uploaded multiple times.
    input.value = "";

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setIsUploading(true);

      const prepared = await convertHeicToJpeg(file);

      const ext = fileExtensionFromMime(prepared.type) || fileExtensionFromName(prepared.name) || "bin";
      const pathname = `wardrobe/${safeRandomUUID()}.${ext}`;

      await upload(pathname, prepared, {
        access: "public",
        handleUploadUrl: "/api/wardrobe/blob",
      });

      await loadItems();
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this wardrobe item? This can't be undone.")) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await fetch(`/api/wardrobe/items/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error(await readErrorMessage(response, "Failed to delete wardrobe item"));
        return;
      }

      await loadItems();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Wardrobe</h1>
            <p className="text-sm text-gray-400">Upload outfit pieces and manage your wardrobe.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
              <span>{isUploading ? "Uploading..." : "Upload"}</span>
              <input
                accept="image/*,.heic,.heif"
                className="sr-only"
                disabled={isUploading}
                onChange={handleUpload}
                type="file"
              />
            </label>

            <button
              className="rounded-md bg-gray-800 px-3 py-2 text-sm hover:bg-gray-700"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-gray-400">Loading wardrobe...</p>
        ) : (
          <>
            {items.length === 0 ? (
              <p className="text-gray-400">No items yet. Upload something to get started.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div key={item.id} className="relative overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
                    <button
                      aria-label="Delete"
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/80"
                      onClick={() => {
                        void handleDelete(item.id);
                      }}
                    >
                      Delete
                    </button>

                    <div className="aspect-square">
                      <img
                        alt="Wardrobe item"
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={item.imageUrl}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
