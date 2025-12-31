'use client';

import { useState } from 'react';

const tops = ['T-shirt', 'Blouse', 'Sweater'];
const bottoms = ['Jeans', 'Skirt', 'Shorts'];
const shoes = ['Sneakers', 'Boots', 'Heels'];

export default function Page() {
  const [outfits, setOutfits] = useState<{ top: string; bottom: string; shoe: string }[]>([]);

  const generateOutfit = () => {
    const top = tops[Math.floor(Math.random() * tops.length)];
    const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const shoe = shoes[Math.floor(Math.random() * shoes.length)];
    setOutfits([...outfits, { top, bottom, shoe }]);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Outfits</h1>
      <p className="mb-6">Generate outfit ideas based on your wardrobe.</p>
      <button
        onClick={generateOutfit}
        className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 mb-4"
      >
        Generate Outfit
      </button>
      <ul className="space-y-2">
        {outfits.map((o, index) => (
          <li
            key={index}
            className="border border-gray-300 rounded-md p-3"
          >
            <div><strong>Top:</strong> {o.top}</div>
            <div><strong>Bottom:</strong> {o.bottom}</div>
            <div><strong>Shoes:</strong> {o.shoe}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
