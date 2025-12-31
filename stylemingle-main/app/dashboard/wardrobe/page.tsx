'use client';

import { useState } from 'react';

export default function Page() {
  const [items, setItems] = useState<string[]>(['T-shirt', 'Jeans', 'Sneakers']);
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    const trimmed = newItem.trim();
    if (trimmed) {
      setItems([...items, trimmed]);
      setNewItem('');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Wardrobe</h1>
      <p className="mb-6">Manage your wardrobe items.</p>
      <div className="mb-4 flex">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new item..."
          className="border border-gray-300 rounded-md px-3 py-2 flex-grow mr-2"
        />
        <button
          onClick={addItem}
          className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800"
        >
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            className="border border-gray-300 rounded-md p-3"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
