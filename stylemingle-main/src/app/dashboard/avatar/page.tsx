'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AvatarPage() {
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWardrobe() {
      try {
        const res = await fetch('/api/wardrobe');
        if (res.ok) {
          const data = await res.json();
          setWardrobeItems(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchWardrobe();
  }, []);

  const isEmpty = !loading && (!wardrobeItems || wardrobeItems.length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <h1 className="text-2xl font-semibold mb-2">Add your first clothing items</h1>
        <p className="mb-6 max-w-md text-base text-deep-espresso/80">
          Upload a few tops, bottoms, and shoes to see outfits appear on your avatar.
        </p>
        <Link
          href="/dashboard/wardrobe"
          className="inline-block rounded-md bg-pastel-coral px-6 py-3 text-white hover:opacity-90 transition"
        >
          Add your first item
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Avatar</h1>
      <p>Customize your avatar here.</p>
    </div>
  );
}
