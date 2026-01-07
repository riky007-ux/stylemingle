'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

const TOKEN_KEY = 'authToken';

export default function WardrobePage() {
  const router = useRouter();
  const [items, setItems] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace('/login');
      return;
    }
    const stored = localStorage.getItem(`wardrobe_${token}`);
    if (stored) {
      try {
        const list = JSON.parse(stored);
        setItems(list);
      } catch {}
    }
  }, [router]);

  const handleAddClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setItems((prev) => {
          const newItems = [...prev, dataUrl];
          const token = localStorage.getItem(TOKEN_KEY);
          if (token) {
            localStorage.setItem(`wardrobe_${token}`, JSON.stringify(newItems));
          }
          return newItems;
        });
      };
      reader.readAsDataURL(file);
      // reset input to allow uploading same file again
      (e.target as HTMLInputElement).value = '';
    }
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Wardrobe</h1>
      <button
        onClick={handleAddClick}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Add Item
      </button>
      <input
        type="file"
        accept="image/*"
        capture
        ref={inputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`Item ${idx}`}
            className="w-full h-40 object-cover rounded"
          />
        ))}
      </div>
    </main>
  );
}
