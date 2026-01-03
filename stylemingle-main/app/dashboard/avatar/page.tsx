'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Page() {
  const [hasWardrobe, setHasWardrobe] = useState(false);
  const [hasOutfit, setHasOutfit] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const wardrobe = JSON.parse(localStorage.getItem('wardrobe') || '[]');
        const outfits = JSON.parse(localStorage.getItem('outfits') || '[]');
        const lastOutfit = localStorage.getItem('lastOutfit');
        setHasWardrobe(Array.isArray(wardrobe) && wardrobe.length > 0);
        setHasOutfit((Array.isArray(outfits) && outfits.length > 0) || !!lastOutfit);
      } catch (error) {
        setHasWardrobe(false);
        setHasOutfit(false);
      }
    }
  }, []);

  const showEmpty = !hasWardrobe || !hasOutfit;

  if (showEmpty) {
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

  return <div>Your Avatar</div>;
}
