"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Image from "next/image";

type WardrobeItem = {
  id: string;
  imageUrl: string;
  createdAt?: string;
};

/**
 * Client-safe unique ID generator.
 * No Node APIs, no window usage, build-safe.
 */
function safeUUID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const JPEG_QUALITY = 0.9;

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

function isHeicFile(file: File) {
  const extension = getFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  return (
    extension === "heic" ||
    extension === "heif" ||
    mimeType.includes("heic") ||
    mimeType.includes("heif")
  );
}

function isPngOrWebp(file: File) {
  const extension = getFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  return (
    extension === "png" ||
    extension === "webp" ||
    mimeType === "image/png" ||
    mimeType === "image/webp"
  );
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
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas conversion failed."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
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
  if (isHeicFile(file)) {
    const heic2any = (await import("heic2any")).default;
    const conversionResult = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: JPEG_QUALITY,
    });

    const jpegBlob = Array.isArray(conversionResult)
      ? conversionResult[0]
      : conversionResult;

    if (!(jpegBlob instanceof Blob)) {
      throw new Error("Unexpected HEIC conversion result.");
    }

    return new File([jpegBlob], buildJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  if (isPngOrWebp(file)) {
    return canvasConvertToJpeg(file);
  }

  const extension = getFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  const isAlreadyJpeg =
    extension === "jpg" ||
    extension === "jpeg" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg";

  if (isAlreadyJpeg) {
    return new File([file], buildJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  }

  return canvasConvertToJpeg(file);
}

function extractFilename(imageUrl: string) {
  if (!imageUrl) return "";
  try {
    const url = new URL(imageUrl, "http://localhost");
    const pathname = url.pathname || "";
    const basename = pathname.split("/").pop() || "";
    return decodeURIComponent(basename);
  } catch {
    return imageUrl;
  }
}

function formatUploadDate(createdAt?: string) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildItemLabel(item: WardrobeItem) {
  const file = extractFilename(item.imageUrl);
  const date = formatUploadDate(item.createdAt);
  const filePart = file ? file : "Wardrobe item";
  return date ? `${filePart} • ${date}` : filePart;
}

function buildThumbnailUrl(imageUrl: string) {
  if (!imageUrl) return imageUrl;

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(imageUrl);
    const parsedUrl = hasProtocol
      ? new URL(imageUrl)
      : new URL(imageUrl, "https://thumbnail.local");

    parsedUrl.searchParams.delete("w");
    parsedUrl.searchParams.delete("h");
    parsedUrl.searchParams.delete("fit");
    parsedUrl.searchParams.delete("q");

    parsedUrl.searchParams.set("w", "400");
    parsedUrl.searchParams.set("h", "400");
    parsedUrl.searchParams.set("fit", "cover");
    parsedUrl.searchParams.set("q", "75");

    if (hasProtocol) {
      return parsedUrl.toString();
    }

    const normalizedPath = imageUrl.startsWith("/")
      ? parsedUrl.pathname
      : parsedUrl.pathname.replace(/^\/+/, "");

    return `${normalizedPath}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return imageUrl;
  }
}

function WardrobeItemCard({
  item,
  onDelete,
}: {
  item: WardrobeItem;
  onDelete: (id: string) => Promise<void>;
}) {
  const [imageError, setImageError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const label = buildItemLabel(item);
  const thumbnailUrl = buildThumbnailUrl(item.imageUrl);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
      {imageError ? (
        <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center text-sm text-zinc-600">
          <div className="font-medium">Preview unavailable</div>
          <div className="mt-1 break-words text-xs text-zinc-500">{label}</div>
        </div>
      ) : (
        <Image
          src={thumbnailUrl}
          alt={label}
          width={400}
          height={400}
          className="h-full w-full object-cover pointer-events-none"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          unoptimized
        />
      )}

      <button
        type="button"
        aria-label="Delete wardrobe item"
        className="absolute right-2 top-2 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-red-400"
        disabled={deleting}
        onClick={async () => {
          if (deleting) return;
          if (typeof confirm === "function") {
            const ok = confirm("Delete this wardrobe item?");
            if (!ok) return;
          }

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

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1">
        <div className="truncate text-xs text-white">{label}</div>
      </div>
    </div>
  );
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

  const handleDelete = async (id: string) => {
    setError(null);

    // Optimistic removal
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      const res = await fetch(`/api/wardrobe/items?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!res.ok) {
        throw new Error("Failed to delete wardrobe item");
      }
    } catch (err) {
      console.error(err);
      setError("Delete failed");
      await loadItems();
    }
  };

  async function handleUpload(file: File) {
    setError(null);
    setUploadNotice(null);
    setLoading(true);

    try {
      const normalizedFile = await normalizeImageToJpeg(file);
      const uploadPath = `wardrobe/${safeUUID()}.jpg`;

      const blob = await upload(
        uploadPath,
        normalizedFile,
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
      setUploadNotice(
        "Sorry, we couldn’t process that image — try another one."
      );
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

      <p className="mb-4 text-sm text-zinc-600">
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
        <div className="mt-2 text-sm text-zinc-600">{uploadNotice}</div>
      )}

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      {loading && (
        <div className="mt-4 text-sm text-zinc-600">Uploading…</div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <WardrobeItemCard key={item.id} item={item} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
