'use client';

import React, { useEffect, useState } from 'react';

const TOKEN_KEY = 'authToken';

interface WardrobeItem {
  id: string;
  imageUrl: string;
}

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchItems = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/wardrobe/items', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        // API may return { items: [...] } or array directly
        const itemsList = Array.isArray(data) ? data : (data.items || []);
        setItems(itemsList);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleUpload = async (imageUrl: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token || !imageUrl) return;
    try {
      await fetch('/api/wardrobe/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl }),
      });
      // re-fetch items after upload
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    // create temporary URL; in real app, would upload file separately
    const imageUrl = URL.createObjectURL(file);
    await handleUpload(imageUrl);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">My Wardrobe</h1>
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="border p-2">
              <img src={item.imageUrl} alt="Wardrobe item" className="w-full h-auto" />
            </div>
          ))}
        </div>
      )}
      <div className="mt-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="mb-2"
        />
      </div>
    </div>
  );
}
