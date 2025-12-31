'use client';

import { useState, useEffect } from 'react';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import { generateOutfit } from '../../../lib/outfit';
import type { Outfit } from '../../../lib/outfit';

export default function Page() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [lastOutfit, setLastOutfit] = useState<Outfit | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('outfits');
    if (stored) {
      try {
        setOutfits(JSON.parse(stored));
      } catch {}
    }
    const paid = localStorage.getItem('isPaid');
    if (paid === 'true') {
      setIsPaid(true);
    }
    const storedLast = localStorage.getItem('lastOutfit');
    if (storedLast) {
      try {
        setLastOutfit(JSON.parse(storedLast));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('outfits', JSON.stringify(outfits));
  }, [outfits]);

  const handleGenerate = () => {
    if (!isPaid && outfits.length >= 5) {
      alert('Upgrade to Pro to generate more outfits.');
      return;
    }
    const outfit = generateOutfit();
    setOutfits([...outfits, outfit]);
    setLastOutfit(outfit);
    localStorage.setItem('lastOutfit', JSON.stringify(outfit));
  };

  return (
    <div className="space-y-l">
      <h1 className="text-3xl font-bold">Outfits</h1>
      <p className="text-deep-espresso/80">Generate outfit ideas based on your wardrobe.</p>
      <Button variant="primary" onClick={handleGenerate}>Generate Outfit</Button>
      {!isPaid && outfits.length >= 5 && (
        <p className="text-pastel-coral font-semibold">You have reached the free limit. Upgrade to unlock unlimited outfits.</p>
      )}
      {lastOutfit && (
        <p className="text-green-600 font-semibold">This outfit is now on your avatar.</p>
      )}
      <div className="space-y-m">
        {outfits.map((o, index) => (
          <Card key={index}>
            <div className="space-y-s">
              <div><strong>Top:</strong> {o.top}</div>
              <div><strong>Bottom:</strong> {o.bottom}</div>
              <div><strong>Shoes:</strong> {o.shoe}</div>
              <div className="text-sm text-deep-espresso/70"><em>{o.explanation}</em></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
