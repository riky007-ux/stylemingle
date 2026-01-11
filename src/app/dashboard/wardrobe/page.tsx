'use client';

import React, { useEffect, useState, useRef } from 'react';

const TOKEN_KEY = 'authToken';

interface WardrobeItem {
  id: string;
  imageUrl: string;
}

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const itemsList = Array.isArray(data) ? data : (data.items || []);
        setItems(itemsList);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch items', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleUpload = async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/wardrobe/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (res.ok) {
        await fetchItems();
      } else {
        console.error('Failed to upload item');
      }
    } catch (error) {
      console.error('Error uploading item', error);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="wardrobe-page">
      <h1>My Wardrobe</h1>
      <div>
        <button onClick={triggerFileInput}>Upload New Item</button>
        <button onClick={fetchItems}>Choose from Library</button>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileInput}
        />
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p>No items found.</p>
      ) : (
        <div className="wardrobe-grid">
          {items.map((item) => (
            <img key={item.id} src={item.imageUrl} alt="Wardrobe Item" />
          ))}
        </div>
      )}
    </div>
  );
}
