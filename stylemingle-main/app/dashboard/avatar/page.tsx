'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Page() {
  const [hasWardrobe, setHasWardrobe] = useState(false);
  const [hasOutfit, setHasOutfit] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const wardrobe = JSON.parse(localStorage.getItem('wardrobe') || '[]');
        const outfits = JSON.parse(localStorage.getItem('outfits') || '[]');
        setHasWardrobe(Array.isArray(wardrobe) && wardrobe.length > 0);
        setHasOutfit(Array.isArray(outfits) && outfits.length > 0);
      } catch (error) {
        setHasWardrobe(false);
        setHasOutfit(false);
      }
    }
  }, []);

  const showEmpty = !hasWardrobe || !hasOutfit;

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      {showEmpty ? (
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Add your first clothing items
          </h1>
          <p style={{ marginBottom: '1rem' }}>
            Upload a few tops, bottoms, and shoes to see outfits appear on your avatar.
          </p>
          <Link href="/dashboard/wardrobe">
            <button style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', border: '1px solid #000' }}>
              Add your first item
            </button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
