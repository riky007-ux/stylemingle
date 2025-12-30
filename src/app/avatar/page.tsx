'use client';
import { useState } from 'react';

export default function AvatarPage() {
  const [size, setSize] = useState(2); // 1: S, 2: M, 3: L, 4: XL

  const label = ['S','M','L','XL'][size - 1];
  const scale = 0.5 + (size - 1) * 0.25; // scale factor between 0.5 and 1.25

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Choose Your Avatar Size</h1>
      <input
        type="range"
        min={1}
        max={4}
        value={size}
        onChange={e => setSize(parseInt(e.target.value))}
        className="mb-4"
      />
      <div className="border p-4">
        <svg width={100 * scale} height={100 * scale} viewBox="0 0 100 100">
          <circle cx="50" cy="30" r="20" fill="#A3C4F3" />
          <rect x="35" y="50" width="30" height="40" fill="#F1A7F1" />
        </svg>
      </div>
      <p className="mt-2">Size: {label}</p>
    </div>
  );
}
