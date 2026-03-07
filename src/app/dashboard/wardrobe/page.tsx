"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { readEnhancedImageMap, setEnhancedImage } from "@/lib/client/enhancedImageCache";
import { isEnabled } from "@/lib/featureFlags";

type WardrobeItem = {
  id: string;
  imageUrl: string;
  createdAt?: string;
  category?: "top" | "bottom" | "shoes" | "outerwear" | "accessory" | "other" | "unknown" | null;
  primaryColor?: string | null;
  styleTag?: string | null;
};



type VisualAnalysis = {
  itemId: string;
  status: "pending" | "complete" | "needs_review" | "failed";
  category?: string | null;
  subcategory?: string | null;
  primaryColor?: string | null;
  secondaryColors?: string[];
  pattern?: string | null;
  material?: string | null;
  seasonality?: string[];
  styleTags?: string[];
  brandCandidate?: string | null;
  sizeEstimateCandidate?: string | null;
  needsReviewFields?: string[];
  overallConfidence?: number;
  fieldConfidence?: Record<string, number>;
  imageUrl?: string;
};

type ReviewDraft = {
  category: string;
  subcategory: string;
  primaryColor: string;
  material: string;
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

const BG_REMOVAL_ENABLED = isEnabled(process.env.NEXT_PUBLIC_BG_REMOVAL);
const AVATAR_V2_ENABLED = isEnabled(process.env.NEXT_PUBLIC_AVATAR_V2);
const DEBUG_FLAGS_ENABLED = isEnabled(process.env.NEXT_PUBLIC_DEBUG_FLAGS);
const VISUAL_AWARENESS_ENABLED = isEnabled(process.env.NEXT_PUBLIC_VISUAL_AWARENESS_ENABLED);

const JPEG_QUALITY = 0.9;
const UPLOAD_CONCURRENCY = 2;

function safeUUID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

    if (!width || !height) throw new Error("Image dimensions are invalid for conversion.");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create drawing context.");

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
  onEnhance,
  isTagging,
}: {
  item: WardrobeItem;
  displayImageUrl: string;
  onDelete: (id: string) => Promise<void>;
  onSaveDetails: (id: string, updates: Partial<WardrobeItem>) => Promise<void>;
  onRetag: (id: string) => Promise<void>;
  onEnhance?: (item: WardrobeItem) => Promise<void>;
  isTagging: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
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
      <div className="absolute left-2 bottom-2 flex gap-1">
        <button type="button" className="rounded bg-white/90 px-2 py-1 text-[11px]" onClick={() => onRetag(item.id)} disabled={isTagging}>
          Re-tag
        </button>
        {onEnhance && (
          <button
            type="button"
            className="rounded bg-white/90 px-2 py-1 text-[11px]"
            disabled={enhancing}
            onClick={async () => {
              setEnhancing(true);
              try {
                await onEnhance(item);
              } finally {
                setEnhancing(false);
              }
            }}
          >
            {enhancing ? "Enhancing…" : "Enhance"}
          </button>
        )}
      </div>

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
          <button
            className="w-full rounded bg-slate-900 text-white py-1"
            onClick={async () => {
              await onSaveDetails(item.id, { category: (category as any) || null, primaryColor: primaryColor || null, styleTag: styleTag || null });
              setEditing(false);
            }}
          >
            Save details
          </button>
        </div>
      )}
    </div>
  );
}

function ExperimentalIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-semibold">Experimental features</p>
      <p>BG Removal: <span className="font-semibold">{BG_REMOVAL_ENABLED ? "ON" : "OFF"}</span></p>
      <p>Avatar v2: <span className="font-semibold">{AVATAR_V2_ENABLED ? "ON" : "OFF"}</span></p>
      {(!BG_REMOVAL_ENABLED || !AVATAR_V2_ENABLED) && (
        <p className="mt-1">Enable in Vercel Preview env vars and redeploy: NEXT_PUBLIC_BG_REMOVAL=1, NEXT_PUBLIC_AVATAR_V2=1</p>
      )}
    </div>
  );
}

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
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
  const [queryDebugEnabled, setQueryDebugEnabled] = useState(false);
  const [analysisByItemId, setAnalysisByItemId] = useState<Record<string, VisualAnalysis>>({});
  const [reviewQueue, setReviewQueue] = useState<VisualAnalysis[]>([]);
  const [analyzingItemIds, setAnalyzingItemIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingReviewItemIds, setSavingReviewItemIds] = useState<string[]>([]);

  useEffect(() => {
    setEnhancedMap(readEnhancedImageMap());
  }, []);

  const loadReviewQueue = useCallback(async () => {
    if (!VISUAL_AWARENESS_ENABLED) return;
    try {
      const res = await fetch("/api/wardrobe/review-queue");
      if (!res.ok) return;
      const data = await res.json();
      const queue = Array.isArray(data?.queue) ? data.queue : [];
      setReviewQueue(queue);
      setReviewDrafts((prev) => {
        const next = { ...prev };
        for (const entry of queue) {
          next[entry.itemId] = next[entry.itemId] || {
            category: entry.category || "",
            subcategory: entry.subcategory || "",
            primaryColor: entry.primaryColor || "",
            material: entry.material || "",
          };
        }
        return next;
      });
      setAnalysisByItemId((prev) => {
        const next = { ...prev };
        for (const entry of queue) next[entry.itemId] = entry;
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  async function loadItems() {
    try {
      const res = await fetch("/api/wardrobe/items");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load wardrobe");
      setItems(data);

      if (VISUAL_AWARENESS_ENABLED) {
        const details = await Promise.all(
          data.map(async (item: WardrobeItem) => {
            const detailRes = await fetch(`/api/wardrobe/items/${item.id}/analysis`);
            if (!detailRes.ok) return null;
            const payload = await detailRes.json();
            return payload?.analysis || null;
          })
        );
        setAnalysisByItemId(
          details.filter(Boolean).reduce((acc: Record<string, VisualAnalysis>, entry: VisualAnalysis) => {
            acc[entry.itemId] = entry;
            return acc;
          }, {})
        );
        await loadReviewQueue();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load wardrobe");
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQueryDebugEnabled(params.get("debug") === "1");
  }, []);

  const runAutoTag = useCallback(async (itemId: string, force = false) => {
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
  }, []);

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

  const handleAnalyze = useCallback(async (itemId: string) => {
    if (!VISUAL_AWARENESS_ENABLED) return;
    setAnalyzingItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
    try {
      const res = await fetch(`/api/wardrobe/items/${itemId}/analyze`, { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Analyze failed");
      if (payload?.analysis) {
        setAnalysisByItemId((prev) => ({ ...prev, [itemId]: payload.analysis }));
      }
      await loadReviewQueue();
      await loadItems();
    } catch (err) {
      console.error(err);
      setError(`Analyze failed for item ${itemId}`);
    } finally {
      setAnalyzingItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  }, [loadReviewQueue]);

  const handleSaveReview = useCallback(async (entry: VisualAnalysis) => {
    const draft = reviewDrafts[entry.itemId] || {
      category: entry.category || "",
      subcategory: entry.subcategory || "",
      primaryColor: entry.primaryColor || "",
      material: entry.material || "",
    };

    setSavingReviewItemIds((prev) => (prev.includes(entry.itemId) ? prev : [...prev, entry.itemId]));
    try {
      const res = await fetch(`/api/wardrobe/items/${entry.itemId}/analysis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category || null,
          subcategory: draft.subcategory || null,
          primaryColor: draft.primaryColor || null,
          material: draft.material || null,
          secondaryColors: entry.secondaryColors || [],
          pattern: entry.pattern || null,
          seasonality: entry.seasonality || [],
          styleTags: entry.styleTags || [],
          brandCandidate: entry.brandCandidate || null,
          sizeEstimateCandidate: entry.sizeEstimateCandidate || null,
          needsReviewFields: [],
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to save review");

      setAnalysisByItemId((prev) => ({ ...prev, [entry.itemId]: payload.analysis }));
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[entry.itemId];
        return next;
      });
      await loadReviewQueue();
      await loadItems();
    } catch (error) {
      console.error(error);
      setError("Failed to confirm review");
    } finally {
      setSavingReviewItemIds((prev) => prev.filter((id) => id !== entry.itemId));
    }
  }, [loadReviewQueue, reviewDrafts]);

  const updateQueueStatus = useCallback((id: string, status: QueueStatus, extra?: Partial<UploadQueueItem>) => {
    setQueue((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status, ...extra } : entry)));
  }, []);

  const enhanceExistingItem = useCallback(async (item: WardrobeItem) => {
    if (!BG_REMOVAL_ENABLED) return;

    try {
      const response = await fetch(item.imageUrl);
      const blob = await response.blob();
      const inputFile = new File([blob], `enhance-${item.id}.png`, { type: blob.type || "image/png" });
      const remover = await import("@/lib/client/removeBackground");
      const enhanced = await remover.removeBackgroundClientSide(inputFile);
      setEnhancedImage(item.id, enhanced.previewUrl);
      setEnhancedMap((prev) => ({ ...prev, [item.id]: enhanced.previewUrl }));
      setUploadNotice("Enhanced preview ready.");
    } catch (err) {
      console.error(err);
      setUploadNotice("Enhancement failed. Keeping original photo.");
    }
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
    const launchWorkers = () => {
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

    launchWorkers();
  }, [processQueueItem, queue]);

  const queueSummary = useMemo(() => {
    const summary = {
      queued: queue.filter((q) => q.status === "queued").length,
      uploading: queue.filter((q) => q.status === "uploading" || q.status === "normalizing" || q.status === "saving").length,
      tagging: queue.filter((q) => q.status === "tagging").length,
      failed: queue.filter((q) => q.status === "failed").length,
      total: queue.length,
    };
    return summary;
  }, [queue]);

  const hasInflightQueue = useMemo(() => queue.some((q) => ["queued", "normalizing", "uploading", "saving", "tagging"].includes(q.status)), [queue]);

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

  const enqueueFiles = (files: FileList | null, source: "library" | "camera") => {
    if (!files || files.length === 0) return;
    cancelQueuedRef.current = false;
    const incoming: UploadQueueItem[] = Array.from(files).map((file) => ({
      id: safeUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "queued",
    }));
    setQueue((prev) => [...incoming, ...prev]);
    if (source === "library" && fileInputRef.current) fileInputRef.current.value = "";
    if (source === "camera" && cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const cancelAll = () => {
    cancelQueuedRef.current = true;
    setQueue((prev) => prev.map((entry) => {
      if (["queued", "normalizing", "uploading", "saving", "tagging"].includes(entry.status)) {
        return { ...entry, status: "cancelled", error: "Cancelled" };
      }
      return entry;
    }));
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter === "all") return true;
      const detectedCategory = analysisByItemId[item.id]?.category || item.category || "unknown";
      return detectedCategory === categoryFilter;
    });
  }, [analysisByItemId, categoryFilter, items]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Wardrobe</h1>
      <ExperimentalIndicator visible={DEBUG_FLAGS_ENABLED || queryDebugEnabled} />
      <p className="mb-4 text-sm text-zinc-600">Upload outfit pieces and manage your wardrobe.</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="rounded border border-zinc-300 px-3 py-1.5 text-sm cursor-pointer bg-white">
          Select from library
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            data-testid="wardrobe-upload-multi"
            onChange={(e) => enqueueFiles(e.target.files, "library")}
          />
        </label>

        <label className="rounded border border-zinc-300 px-3 py-1.5 text-sm cursor-pointer bg-white">
          Take Photos
          <input
            ref={cameraInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            data-testid="wardrobe-upload-camera"
            onChange={(e) => enqueueFiles(e.target.files, "camera")}
          />
        </label>

        {BG_REMOVAL_ENABLED && (
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={enhancePhoto} onChange={(e) => setEnhancePhoto(e.target.checked)} />
            Enhance photo (remove background)
          </label>
        )}

        <button type="button" onClick={handleAutoTagCloset} disabled={bulkTagging || items.length === 0} className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50">
          {bulkTagging ? (bulkTagProgress || "Auto-tagging…") : "Auto-tag my closet"}
        </button>

        {VISUAL_AWARENESS_ENABLED && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded border border-zinc-300 px-2 py-1 text-sm bg-white">
            <option value="all">All categories</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="shoes">Shoes</option>
            <option value="outerwear">Outerwear</option>
            <option value="accessory">Accessory</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        )}
      </div>

      <div className="mt-4 rounded-xl border p-3 bg-zinc-50" data-testid="upload-queue-panel">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {queueSummary.queued} queued • {queueSummary.uploading} uploading • {queueSummary.tagging} tagging • {queueSummary.failed} failed
          </p>
          <button type="button" onClick={cancelAll} className="text-xs rounded border px-2 py-1" disabled={queue.length === 0 && !hasInflightQueue}>Cancel All</button>
        </div>
        {queue.length === 0 && !hasInflightQueue ? (
          <p className="mt-3 text-xs text-zinc-500">No uploads in queue.</p>
        ) : (
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
        )}
      </div>

      {uploadNotice && <div className="mt-2 text-sm text-zinc-600">{uploadNotice}</div>}
      {bulkTagProgress && bulkTagging && <div className="mt-2 text-sm text-zinc-600">{bulkTagProgress}</div>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      {VISUAL_AWARENESS_ENABLED && (
        <div className="mt-6 rounded-xl border p-4 bg-zinc-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Needs review ({reviewQueue.length})</h2>
            <button className="text-xs rounded border px-2 py-1" onClick={() => void loadReviewQueue()}>Refresh</button>
          </div>
          {reviewQueue.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No low-confidence fields right now.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {reviewQueue.map((entry) => (
                <div key={entry.itemId} className="rounded border bg-white p-3 text-xs">
                  <p className="font-medium mb-2">Item {entry.itemId.slice(0, 8)} • Review: {entry.needsReviewFields?.join(", ") || "none"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="border rounded p-1" value={reviewDrafts[entry.itemId]?.category ?? entry.category ?? ""} placeholder="Category" onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [entry.itemId]: { ...(prev[entry.itemId] || { category: entry.category || "", subcategory: entry.subcategory || "", primaryColor: entry.primaryColor || "", material: entry.material || "" }), category: e.target.value } }))} />
                    <input className="border rounded p-1" value={reviewDrafts[entry.itemId]?.primaryColor ?? entry.primaryColor ?? ""} placeholder="Primary color" onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [entry.itemId]: { ...(prev[entry.itemId] || { category: entry.category || "", subcategory: entry.subcategory || "", primaryColor: entry.primaryColor || "", material: entry.material || "" }), primaryColor: e.target.value } }))} />
                    <input className="border rounded p-1" value={reviewDrafts[entry.itemId]?.subcategory ?? entry.subcategory ?? ""} placeholder="Subcategory" onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [entry.itemId]: { ...(prev[entry.itemId] || { category: entry.category || "", subcategory: entry.subcategory || "", primaryColor: entry.primaryColor || "", material: entry.material || "" }), subcategory: e.target.value } }))} />
                    <input className="border rounded p-1" value={reviewDrafts[entry.itemId]?.material ?? entry.material ?? ""} placeholder="Material" onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [entry.itemId]: { ...(prev[entry.itemId] || { category: entry.category || "", subcategory: entry.subcategory || "", primaryColor: entry.primaryColor || "", material: entry.material || "" }), material: e.target.value } }))} />
                  </div>
                  <button className="mt-2 rounded bg-slate-900 px-2 py-1 text-white" onClick={() => void handleSaveReview(entry)} disabled={savingReviewItemIds.includes(entry.itemId)}>
                    {savingReviewItemIds.includes(entry.itemId) ? "Saving…" : "Confirm review"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filteredItems.map((item) => {
          const analysis = analysisByItemId[item.id];
          const detectedCategory = analysis?.category || item.category || "unknown";
          return (
            <div key={item.id}>
              <WardrobeItemCard
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
                onRetag={async (id) => {
                  await runAutoTag(id, true);
                }}
                onEnhance={BG_REMOVAL_ENABLED ? enhanceExistingItem : undefined}
                isTagging={taggingItemIds.includes(item.id)}
              />
              {VISUAL_AWARENESS_ENABLED && (
                <div className="mt-1 rounded border p-2 text-xs bg-white">
                  <div className="flex items-center justify-between">
                    <span>Status: {analysis?.status || "not_analyzed"}</span>
                    <button className="rounded border px-2 py-0.5" onClick={() => void handleAnalyze(item.id)} disabled={analyzingItemIds.includes(item.id)}>
                      {analyzingItemIds.includes(item.id) ? "Analyzing…" : "Analyze"}
                    </button>
                  </div>
                  <p className="mt-1 capitalize">Detected category: {detectedCategory}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}