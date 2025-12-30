'use client';
import { useEffect, useState } from 'react';

interface Outfit {
  id: string;
  itemIds: string;
  description: string;
}

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchOutfits = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/outfits', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setOutfits(data);
    } else {
      setError(data.error || 'Failed to fetch outfits');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) {
      fetchOutfits();
    }
  }, [token]);

  const generateOutfit = async () => {
    setGenerating(true);
    setError('');
    const res = await fetch('/api/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemIds: [] }),
    });
    const data = await res.json();
    if (res.ok) {
      setOutfits(prev => [...prev, data]);
    } else {
      setError(data.error || 'Failed to generate outfit');
    }
    setGenerating(false);
  };

  const rateOutfit = async (outfitId: string, rating: number) => {
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ outfitId, rating }),
    });
  };

  if (!token) return <p className="p-4">Please log in to see your outfits.</p>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-semibold mb-6 text-center">Your Outfits</h1>
      {error && <p className="text-red-600 mb-4 text-center">{error}</p>}
      <div className="flex justify-center mb-6">
        <button
          onClick={generateOutfit}
          className="py-2 px-4 rounded bg-purple-600 text-white hover:bg-purple-700 transition"
          disabled={generating}
        >
          {generating ? 'Generating…' : 'Generate Outfit'}
        </button>
      </div>
      {loading ? (
        <p className="text-center">Loading outfits…</p>
      ) : outfits.length === 0 ? (
        <p className="text-center text-gray-600">You haven’t generated any outfits yet.</p>
      ) : (
        <ul className="space-y-4 max-w-2xl mx-auto">
          {outfits.map(o => (
            <li key={o.id} className="bg-white shadow rounded p-4">
              <p className="mb-3">{o.description}</p>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => rateOutfit(o.id, n)}
                    className="text-yellow-500 hover:text-yellow-600 text-sm"
                  >
                    {n}⭐
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
