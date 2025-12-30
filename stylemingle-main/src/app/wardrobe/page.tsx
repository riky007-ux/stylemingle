'use client';
import { useEffect, useState } from 'react';

interface WardrobeItem {
  id: string;
  imageUrl: string;
  description: string;
}

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [colors, setColors] = useState('');
  const [pattern, setPattern] = useState('');
  const [material, setMaterial] = useState('');
  const [brand, setBrand] = useState('');
  const [fitStyle, setFitStyle] = useState('');
  const [tagging, setTagging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/wardrobe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setItems(data);
    } else {
      setError(data.error || 'Failed to fetch items');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) {
      fetchItems();
    }
  }, [token]);

  const autoTag = async () => {
    if (!imageUrl) return;
    setTagging(true);
    try {
      const res = await fetch('/api/wardrobe/auto-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      // Only update fields if keys exist
      if (data.category) setCategory(data.category);
      if (data.colors) setColors(Array.isArray(data.colors) ? data.colors.join(', ') : data.colors);
      if (data.pattern) setPattern(data.pattern);
      if (data.material) setMaterial(data.material);
      if (data.brand) setBrand(data.brand);
      if (data.fitStyle) setFitStyle(data.fitStyle);
    } catch {
      // silently fail if tagging fails
    }
    setTagging(false);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    // Compose a description string from tags and the user-provided description
    const tagParts: string[] = [];
    if (category) tagParts.push(`Category: ${category}`);
    if (colors) tagParts.push(`Colors: ${colors}`);
    if (pattern) tagParts.push(`Pattern: ${pattern}`);
    if (material) tagParts.push(`Material: ${material}`);
    if (brand) tagParts.push(`Brand: ${brand}`);
    if (fitStyle) tagParts.push(`Fit: ${fitStyle}`);
    const finalDesc =
      tagParts.join(' · ') + (description ? (tagParts.length ? ' · ' : '') + description : '');

    const res = await fetch('/api/wardrobe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ imageUrl, description: finalDesc }),
    });
    const data = await res.json();
    if (res.ok) {
      setItems(prev => [...prev, data]);
      // Reset form fields
      setImageUrl('');
      setDescription('');
      setCategory('');
      setColors('');
      setPattern('');
      setMaterial('');
      setBrand('');
      setFitStyle('');
    } else {
      setError(data.error || 'Failed to add item');
    }
  };

  const deleteItem = async (id: string) => {
    await fetch(`/api/wardrobe/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems(prev => prev.filter(item => item.id !== id));
  };

  if (!token) {
    return <p className="p-4">Please log in to manage your wardrobe.</p>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-semibold mb-6 text-center">My Wardrobe</h1>
      {error && <p className="text-red-600 mb-4 text-center">{error}</p>}
      <form onSubmit={addItem} className="max-w-xl mx-auto bg-white p-6 shadow rounded space-y-3 mb-8">
      <div>
          <label className="block text-sm font-medium mb-1">Image URL</label>
          <input
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-indigo-400"
            required
          />
        </div>
        <button
          type="button"
          onClick={autoTag}
          className="py-1 px-3 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
          disabled={tagging || !imageUrl}
        >
          {tagging ? 'Tagging…' : 'Auto Tag'}
        </button>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., jacket"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Colors</label>
          <input
            type="text"
            value={colors}
            onChange={e => setColors(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., black, white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pattern</label>
          <input
            type="text"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., striped"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Material</label>
          <input
            type="text"
            value={material}
            onChange={e => setMaterial(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., cotton"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Brand</label>
          <input
            type="text"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., Nike"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fit Style</label>
          <input
            type="text"
            value={fitStyle}
            onChange={e => setFitStyle(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., loose"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Additional Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Any extra details"
          />
        </div>
        <button type="submit" className="w-full py-2 rounded bg-green-600 text-white hover:bg-green-700 transition">
          Add Item
        </button>
      </form>
      {loading ? (
        <p className="text-center">Loading wardrobe…</p>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-600">Your wardrobe is empty. Start by adding a few pieces!</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {items.map(item => (
            <li key={item.id} className="bg-white shadow rounded overflow-hidden">
              <img src={item.imageUrl} alt={item.description} className="w-full h-48 object-cover" />
              <div className="p-4">
                <p className="mb-2">{item.description}</p>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
