"use client";

import { useEffect, useState } from "react";

type WardrobeItem = {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
};

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch("/api/wardrobe/items");
        if (!res.ok) {
          throw new Error("Failed to load wardrobe");
        }
        const data = await res.json();
        setItems(data);
      } catch (err) {
        setError("Unable to load wardrobe items.");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const handleDelete = async (id: string) => {
    const confirmed = confirm("Delete this wardrobe item?");
    if (!confirmed) return;

    const prev = items;
    setItems((items) => items.filter((item) => item.id !== id));

    const res = await fetch("/api/wardrobe/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      alert("Delete failed. Please refresh.");
      setItems(prev);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading wardrobe…</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        No wardrobe items yet.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <WardrobeItemCard
            key={item.id}
            item={item}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function WardrobeItemCard({
  item,
  onDelete,
}: {
  item: WardrobeItem;
  onDelete: () => void;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imageError ? (
        <div className="flex h-full w-full flex-col items-center justify-center text-center text-xs text-zinc-500">
          <div className="font-medium">Preview unavailable</div>
          <div className="mt-1 break-all px-2">
            {item.id}
          </div>
        </div>
      ) : (
        <img
          src={item.thumbnailUrl || item.imageUrl}
          alt="Wardrobe item"
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      )}

      <button
        type="button"
        aria-label="Delete wardrobe item"
        className="absolute right-2 top-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
