'use client';

import { useState, useEffect } from 'react';
import type { Outfit } from '../../../lib/outfit';

const sizes = [
  { label: 'S', width: 120, height: 240 },
  { label: 'M', width: 140, height: 280 },
  { label: 'L', width: 160, height: 320 },
  { label: 'XL', width: 180, height: 360 },
];

export default function Page() {
  const [selectedSize, setSelectedSize] = useState(sizes[1]); // default M
  const [currentOutfit, setCurrentOutfit] = useState<Outfit | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('lastOutfit') : null;
    if (stored) {
      try {
        const outfit = JSON.parse(stored) as Outfit;
        setCurrentOutfit(outfit);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Avatar</h1>
      <p className="mb-4">Customize your avatar by selecting a body size.</p>
      <div className="flex space-x-4 mb-6">
        {sizes.map((s) => (
          <button
            key={s.label}
            onClick={() => setSelectedSize(s)}
            className={`border p-2 rounded-md ${selectedSize.label === s.label ? 'bg-gray-100' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div
        className="relative mx-auto"
        style={{ width: selectedSize.width, height: selectedSize.height }}
      >
        <img
          src={`/avatars/body-${selectedSize.label.toLowerCase()}.svg`}
          alt="base body"
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
        <img
          src={currentOutfit?.topLayer ?? '/avatars/top.svg'}
          alt="top layer"
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
        <img
          src={currentOutfit?.bottomLayer ?? '/avatars/bottom.svg'}
          alt="bottom layer"
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
        <img
          src={currentOutfit?.shoeLayer ?? '/avatars/shoes.svg'}
          alt="shoes layer"
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
        {currentOutfit?.accessoryLayer && (
          <img
            src={currentOutfit.accessoryLayer}
            alt="accessory layer"
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          />
        )}
      </div>
    </div>
  );
}
