'use client';

import { useState } from 'react';

const styles = [
  { style: 'Casual', description: 'Relaxed everyday look', emoji: '🧢' },
  { style: 'Formal', description: 'Polished professional attire', emoji: '🎩' },
  { style: 'Sporty', description: 'Active and athletic gear', emoji: '🏃‍♂️' },
];

export default function Page() {
  const [selected, setSelected] = useState(styles[0]);
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Avatar</h1>
      <p className="mb-6">Customize your avatar's style.</p>
      <div className="flex space-x-4 mb-6">
        {styles.map((s) => (
          <button
            key={s.style}
            onClick={() => setSelected(s)}
            className={`border p-4 rounded-md ${selected.style === s.style ? 'bg-gray-100' : ''}`}
          >
            <div className="text-3xl mb-2">{s.emoji}</div>
            <div>{s.style}</div>
          </button>
        ))}
      </div>
      <div>
        <h2 className="text-xl font-semibold">Selected Style: {selected.style}</h2>
        <p>{selected.description}</p>
      </div>
    </div>
  );
}
