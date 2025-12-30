'use client';
import { useState } from 'react';

export default function AvatarPage() {
  const [size, setSize] = useState(2); // values 1–4 correspond to S–XL
  const labels = ['S', 'M', 'L', 'XL'];
  const scaleFactors = [0.5, 0.75, 1, 1.25];

  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <h1 className="text-3xl font-semibold mb-6 text-center">Customize Your Avatar</h1>
      <div className="mb-4 w-full max-w-sm">
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={size}
          onChange={e => setSize(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs mt-1 px-1">
          {labels.map(label => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
      <div className="border p-6 bg-white shadow rounded">
        <svg
          width={100 * scaleFactors[size - 1]}
          height={100 * scaleFactors[size - 1]}
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="30" r="20" fill="#A3C4F3" />
          <rect x="35" y="50" width="30" height="40" fill="#F1A7F1" />
        </svg>
      </div>
      <p className="mt-4">Selected size: <strong>{labels[size - 1]}</strong></p>
      <p className="text-sm text-gray-600 mt-2">This simple avatar represents you on the platform.</p>
    </div>
  );
}
