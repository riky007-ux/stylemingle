"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { readEnhancedImageMap, setEnhancedImage } from "@/lib/client/enhancedImageCache";

type WardrobeItem = {
  id: string;
  imageUrl: string;
  createdAt?: string;
  category?: "top" | "bottom" | "shoes" | "outerwear" | "accessory" | "other" | "unknown" | null;
  primaryColor?: string | null;
  styleTag?: string | null;
};

type QueueStatus = "queued" | "uploading" | "normalizing" | "saving" | "tagging" | "done" | "failed" | "cancelled";
type UploadQueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: QueueStatus;
  error?: string;
  itemId?: string;
};

const BG_REMOVAL_ENABLED = process.env.NEXT_PUBLIC_BG_REMOVAL === "1";

function safeUUID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const JPEG_QUALITY = 0.9;
const UPLOAD_CONCURRENCY = 2;

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  if (parts.length <= 1) return "";
  return parts.pop()?.toLowerCase() || "";
}

function getFileBaseName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return fileName;
  return fileName.slice(0, dotIndex);
}

function buildJpegFileName(fileName: string) {
  const baseName = getFileBaseName(fileName).trim() || safeUUID();
  return `${baseName}.jpg`;
}

function isHeicOrHeif(file: File) {
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  return lowerName.endsWith(".heic") || mime.includes("heic") || lowerName.endsWith(".heif") || mime.includes("heif");
}

function isPngOrWebp(file: File) {
  const extension = getFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  return extension === "png" || extension === "webp" || mimeType === "image/png" || mimeType === "image/webp";
}

async function canvasConvertToJpeg(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode image."));
      img.src = objectUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error("Image dimensions are invalid for conversion.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create drawing context.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas conversion failed."));
          return;
        }
        resolve(blob);
      }, "image/jpeg", JPEG_QUALITY);
    });

    return new File([jpegBlob], buildJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeImageToJpeg(file: File) {
  if (isHeicOrHeif(file)) return file;
  if (isPngOrWebp(file)) return canvasConvertToJpeg(file);

  const extension = getFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  const isAlreadyJpeg = extension === "jpg" || extension === "jpeg" || mimeType === "image/jpeg" || mimeType === "image/jpg";

  if (isAlreadyJpeg) {
    return new File([file], buildJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  }

  return canvasConvertToJpeg(file);
}

function buildThumbnailUrl(imageUrl: string) {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    return imageUrl;
  }

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(imageUrl);
    const parsedUrl = hasProtocol ? new URL(imageUrl) : new URL(imageUrl, "https://thumbnail.local");

    parsedUrl.searchParams.set("w", "400");
    parsedUrl.searchParams.set("h", "400");
    parsedUrl.searchParams.set("fit", "cover");
    parsedUrl.searchParams.set("q", "75");

    if (hasProtocol) return parsedUrl.toString();
    const normalizedPath = imageUrl.startsWith("/") ? parsedUrl.pathname : parsedUrl.pathname.replace(/^\/+/, "");
    return `${normalizedPath}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return imageUrl;
  }
}

function WardrobeItemCard({
  item,
  displayImageUrl,
  onDelete,
  onSaveDetails,
  onRetag,
  isTagging,
}: {
  item: WardrobeItem;
  displayImageUrl: string;
  onDelete: (id: string) => Promise<void>;
  onSaveDetails: (id: string, updates: Partial<WardrobeItem>) => Promise<void>;
  onRetag: (id: string) => Promise<void>;
  isTagging: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(item.category || "");
  const [primaryColor, setPrimaryColor] = useState(item.primaryColor || "");
  const [styleTag, setStyleTag] = useState(item.styleTag || "");

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
      <Image src={buildThumbnailUrl(displayImageUrl)} alt="Wardrobe item" width={400} height={400} className="h-full w-full object-cover pointer-events-none" unoptimized />
      <button
        type="button"
        className="absolute right-2 top-2 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white"
        disabled={deleting}
        onClick={async () => {
          if (deleting) return;
          if (typeof confirm === "function" && !confirm("Delete this wardrobe item?")) return;
          setDeleting(true);
          try {
            await onDelete(item.id);
          } finally {
            setDeleting(false);
          }
        }}
      >
        Delete
      </button>
      <button type="button" className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-xs" onClick={() => setEditing((v) => !v)}>
        {item.category ? "Edit" : "Add details"}
      </button>
      {isTagging && <div className="absolute left-2 top-10 rounded bg-black/70 px-2 py-1 text-[11px] text-white">Analyzing…</div>}
      <div className="absolute right-2 bottom-10 rounded bg-white/85 px-2 py-1 text-[11px]">
        <div className="capitalize">{item.category || "unknown"}</div>
        <div className="capitalize">{item.primaryColor || "unknown"}</div>
        <div className="capitalize">{item.styleTag || "unknown"}</div>
      </div>
      <button type="button" className="absolute right-2 bottom-2 rounded bg-white/90 px-2 py-1 text-[11px]" onClick={() => onRetag(item.id)} disabled={isTagging}>
        Re-tag
      </button>

      {editing && (
        <div className="absolute inset-0 bg-white/95 p-2 text-xs">
          <select className="w-full border rounded p-1 mb-1" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Category</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="shoes">Shoes</option>
            <option value="outerwear">Outerwear</option>
            <option value="accessory">Accessory</option>
          </select>
          <input className="w-full border rounded p-1 mb-1" placeholder="Primary color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          <input className="w-full border rounded p-1 mb-2" placeholder="Style tag (optional)" value={styleTag} onChange={(e) => setStyleTag(e.target.value)} />
          <button className="w-full rounded bg-slate-900 text-white py-1" onClick={async () => {
            await onSaveDetails(item.id, { category: (category as any) || null, primaryColor: primaryColor || null, styleTag: styleTag || null });
            setEditing(false);
          }}>Save details</button>
        </div>
      )}
    </div>
  );
}

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeWorkersRef = useRef(0);
  const cancelQueuedRef = useRef(false);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [taggingItemIds, setTaggingItemIds] = useState<string[]>([]);
  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkTagProgress, setBulkTagProgress] = useState<string | null>(null);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [enhancePhoto, setEnhancePhoto] = useState(BG_REMOVAL_ENABLED);
  const [enhancedMap, setEnhancedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setEnhancedMap(readEnhancedImageMap());
  }, []);

  async function loadItems() {
    try {
      const res = await fetch("/api/wardrobe/items");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load wardrobe");
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load wardrobe");
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const runAutoTag = async (itemId: string, force = false) => {
    setTaggingItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
    try {
      const res = await fetch("/api/ai/wardrobe/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, force }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Auto-tagging failed");
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...payload } : item)));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setTaggingItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const handleSaveDetails = async (id: string, updates: Partial<WardrobeItem>) => {
    const res = await fetch(`/api/wardrobe/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
    }
  };

  const updateQueueStatus = useCallback((id: string, status: QueueStatus, extra?: Partial<UploadQueueItem>) => {
    setQueue((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status, ...extra } : entry)));
  }, []);

  const processQueueItem = useCallback(async (entry: UploadQueueItem) => {
    updateQueueStatus(entry.id, "normalizing");

    try {
      let normalizedFile = isHeicOrHeif(entry.file) ? entry.file : await normalizeImageToJpeg(entry.file);
      let enhancedPreview = "";

      if (BG_REMOVAL_ENABLED && enhancePhoto && !isHeicOrHeif(normalizedFile)) {
        try {
          const remover = await import("@/lib/client/removeBackground");
          const enhanced = await remover.removeBackgroundClientSide(normalizedFile);
          normalizedFile = enhanced.file;
          enhancedPreview = enhanced.previewUrl;
        } catch (bgErr) {
          console.warn("Background removal failed, using original", bgErr);
        }
      }

      if (cancelQueuedRef.current) {
        updateQueueStatus(entry.id, "cancelled");
        return;
      }

      updateQueueStatus(entry.id, "uploading");
      const uploadPath = `wardrobe/${safeUUID()}-${normalizedFile.name.replace(/\s+/g, "-")}`;
      const blob = await upload(uploadPath, normalizedFile, {
        access: "public",
        handleUploadUrl: "/api/wardrobe/blob",
      });

      if (cancelQueuedRef.current) {
        updateQueueStatus(entry.id, "cancelled");
        return;
      }

      updateQueueStatus(entry.id, "saving");
      const res = await fetch("/api/wardrobe/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: blob.url }),
      });

      if (!res.ok) throw new Error("Failed to save wardrobe item");

      const created = await res.json();
      setItems((prev) => [created, ...prev]);
      if (enhancedPreview) {
        setEnhancedImage(created.id, enhancedPreview);
        setEnhancedMap((prev) => ({ ...prev, [created.id]: enhancedPreview }));
      }

      updateQueueStatus(entry.id, "tagging", { itemId: created.id });
      const tagged = await runAutoTag(created.id, false);
      if (!tagged) {
        updateQueueStatus(entry.id, "failed", { itemId: created.id, error: "Tagging failed. Item saved." });
        return;
      }

      updateQueueStatus(entry.id, "done", { itemId: created.id });
    } catch (err) {
      console.error(err);
      updateQueueStatus(entry.id, "failed", { error: "Upload failed" });
    }
  }, [enhancePhoto, runAutoTag, updateQueueStatus]);

  useEffect(() => {
    const launchWorkers = async () => {
      if (cancelQueuedRef.current) return;

      const waiting = queue.filter((q) => q.status === "queued");
      const capacity = UPLOAD_CONCURRENCY - activeWorkersRef.current;
      if (capacity <= 0 || waiting.length === 0) return;

      waiting.slice(0, capacity).forEach((entry) => {
        activeWorkersRef.current += 1;
        void processQueueItem(entry).finally(() => {
          activeWorkersRef.current -= 1;
        });
      });
    };

    void launchWorkers();
  }, [processQueueItem, queue]);

  const queueSummary = useMemo(() => {
    const total = queue.length;
    const uploaded = queue.filter((q) => ["saving", "tagging", "done", "failed"].includes(q.status)).length;
    const tagged = queue.filter((q) => ["done", "failed"].includes(q.status)).length;
    return {
      total,
      uploaded,
      tagged,
    };
  }, [queue]);

  const handleAutoTagCloset = async () => {
    setBulkTagging(true);
    setBulkTagProgress(null);
    setError(null);
    const BATCH_SIZE = 6;
    try {
      const idsToTag = items.filter((item) => !item.category || !item.primaryColor || !item.styleTag).map((item) => item.id);
      if (idsToTag.length === 0) {
        setBulkTagProgress("Everything is already tagged.");
        return;
      }
      for (let start = 0; start < idsToTag.length; start += BATCH_SIZE) {
        const chunk = idsToTag.slice(start, start + BATCH_SIZE);
        setBulkTagProgress(`Auto-tagging ${Math.min(start + chunk.length, idsToTag.length)}/${idsToTag.length}…`);
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch("/api/ai/wardrobe/tag-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: chunk }),
        });
        // eslint-disable-next-line no-await-in-loop
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || "Bulk auto-tagging failed");
        const updatedRows = Array.isArray(payload?.updated) ? payload.updated : [];
        if (updatedRows.length > 0) {
          const updatedById = new Map<string, WardrobeItem>(updatedRows.map((row: WardrobeItem) => [row.id, row]));
          setItems((prev) => prev.map((item) => {
            const updated = updatedById.get(item.id);
            return updated ? { ...item, ...updated } : item;
          }));
        }
      }
    } catch (err) {
      console.error(err);
      setError("Auto-tagging failed");
    } finally {
      setBulkTagging(false);
    }
  };

  const enqueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    cancelQueuedRef.current = false;
    const incoming: UploadQueueItem[] = Array.from(files).map((file) => ({
      id: safeUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "queued",
    }));
    setQueue((prev) => [...incoming, ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelAll = () => {
    cancelQueuedRef.current = true;
    setQueue((prev) => prev.map((entry) => (entry.status === "queued" ? { ...entry, status: "cancelled" } : entry)));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Wardrobe</h1>
      <p className="mb-4 text-sm text-zinc-600">Upload outfit pieces and manage your wardrobe.</p>

      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => enqueueFiles(e.target.files)} />
      {BG_REMOVAL_ENABLED && (
        <label className="ml-3 text-sm inline-flex items-center gap-2">
          <input type="checkbox" checked={enhancePhoto} onChange={(e) => setEnhancePhoto(e.target.checked)} />
          Enhance photo (remove background)
        </label>
      )}

      <button type="button" onClick={handleAutoTagCloset} disabled={bulkTagging || items.length === 0} className="ml-3 rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50">
        {bulkTagging ? (bulkTagProgress || "Auto-tagging…") : "Auto-tag my closet"}
      </button>

      {queue.length > 0 && (
        <div className="mt-4 rounded-xl border p-3 bg-zinc-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Uploading {queueSummary.uploaded}/{queueSummary.total} · Tagging {queueSummary.tagged}/{queueSummary.total}</p>
            <button type="button" onClick={cancelAll} className="text-xs rounded border px-2 py-1">Abort / Cancel All</button>
          </div>
          <ul className="mt-3 space-y-2 max-h-64 overflow-auto">
            {queue.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 rounded border bg-white p-2 text-xs">
                <Image src={entry.previewUrl} alt={entry.file.name} width={38} height={38} className="h-10 w-10 rounded object-cover" unoptimized />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{entry.file.name}</p>
                  <p className="capitalize text-zinc-500">{entry.status}{entry.error ? ` · ${entry.error}` : ""}</p>
                </div>
                {entry.status === "failed" && entry.itemId && (
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={async () => {
                      const tagged = await runAutoTag(entry.itemId!, true);
                      if (tagged) updateQueueStatus(entry.id, "done", { error: undefined });
                    }}
                  >
                    Retry tag
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploadNotice && <div className="mt-2 text-sm text-zinc-600">{uploadNotice}</div>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <WardrobeItemCard
            key={item.id}
            item={item}
            displayImageUrl={enhancedMap[item.id] || item.imageUrl}
            onDelete={async (id) => {
              setItems((prev) => prev.filter((it) => it.id !== id));
              const res = await fetch(`/api/wardrobe/items?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
              if (!res.ok) {
                setError("Delete failed");
                await loadItems();
              }
            }}
            onSaveDetails={handleSaveDetails}
            onRetag={(id) => runAutoTag(id, true)}
            isTagging={taggingItemIds.includes(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
